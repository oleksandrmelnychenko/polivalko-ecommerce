using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PoliValko.Catalog.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.Navkolo.Configuration;

namespace PoliValko.Navkolo.Integrations.NavkoloApi;

// Contract: https://api.dntrade.com.ua/docs/swagger.json (reviewed 2026-11-08).
internal sealed class HttpNavkoloClient(HttpClient http, IOptions<NavkoloOptions> options, DnTradeRequestGate gate) : INavkoloClient
{
    private readonly NavkoloOptions _options = options.Value;
    private string? _storeId;

    private async Task<JsonDocument> SendAsync(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            await gate.WaitAsync(ct);
            using var request = new HttpRequestMessage(method, path);
            request.Headers.Add("ApiKey", _options.ApiKey);
            if (body is not null) request.Content = JsonContent.Create(body);
            using var response = await http.SendAsync(request, ct);
            if (response.StatusCode == HttpStatusCode.TooManyRequests && attempt < 2)
            {
                var delay = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(60);
                await Task.Delay(TimeSpan.FromSeconds(Math.Clamp(delay.TotalSeconds, 1, 120)), ct);
                continue;
            }
            // Never put provider response bodies (customer data or credentials) in logs.
            if (!response.IsSuccessStatusCode) throw new NavkoloUnavailableException($"DNTrade HTTP {(int)response.StatusCode}.");
            var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (Number(json.RootElement, "status") != 1)
            {
                json.Dispose();
                throw new NavkoloUnavailableException("DNTrade відхилив запит. Перевірте ключ і параметри інтеграції.");
            }
            return json;
        }
    }

    public async Task<IReadOnlyList<Features.Settings.NavkoloStoreDto>> GetStoresAsync(CancellationToken ct)
    {
        using var json = await SendAsync(HttpMethod.Get, "products/stores", null, ct);
        return Rows(json.RootElement, "stores").Select(s =>
        {
            var id = Required(s, "id");
            if (!Guid.TryParse(id, out var uuid)) throw new NavkoloUnavailableException("Некоректний ідентифікатор складу DNTrade.");
            return new Features.Settings.NavkoloStoreDto(uuid.ToString(), Text(s, "title") ?? id);
        }).DistinctBy(s => s.Id).ToArray();
    }

    public async Task<IReadOnlyList<Features.Settings.NavkoloStatusDto>> GetStatusesAsync(CancellationToken ct)
    {
        using var json = await SendAsync(HttpMethod.Get, "orders/statuslist", null, ct);
        return Rows(json.RootElement, "data").Select(s => new Features.Settings.NavkoloStatusDto(
            checked((int)Number(s, "id")), Required(s, "title"))).ToArray();
    }

    public async Task CancelOrderAsync(Guid orderId, string? reference, CancellationToken ct)
    {
        if (reference is not null && (!Guid.TryParse(reference, out var parsed) || parsed != orderId))
            throw new NavkoloUnavailableException("Ідентифікатор Навколо не відповідає замовленню. Потрібна перевірка обліку.");
        var status = (await GetStatusesAsync(ct)).SingleOrDefault(s => s.Id == _options.CancellationStatusId)
            ?? throw new NavkoloUnavailableException("Оберіть статус скасування в Налаштування → Навколо.");
        var current = await CancellationStateAsync(orderId, ct);
        if (current == status.Name || current == status.Id.ToString(CultureInfo.InvariantCulture)) return;
        using var response = await SendAsync(HttpMethod.Post, "orders/setstatus", new { id = orderId, status = status.Id }, ct);
        var confirmed = await CancellationStateAsync(orderId, ct);
        if (confirmed != status.Name && confirmed != status.Id.ToString(CultureInfo.InvariantCulture))
            throw new NavkoloUnavailableException("Навколо ще не підтвердило статус скасування. Спроба буде повторена.");
    }

    private async Task<string> CancellationStateAsync(Guid orderId, CancellationToken ct)
    {
        using var json = await SendAsync(HttpMethod.Get, $"orders/list?limit=50&id={orderId}", null, ct);
        var rows = Rows(json.RootElement, "orders");
        if (rows.Count != 1 || !Guid.TryParse(Text(rows[0], "external_id"), out var id) || id != orderId)
            throw new NavkoloUnavailableException("Замовлення не підтверджене в Навколо. Повторна звірка потрібна перед звільненням резерву.");
        if (Number(rows[0], "load") != 0)
            throw new NavkoloUnavailableException("Замовлення вже відвантажене в Навколо. Оформіть повернення товару в обліку.");
        return Required(rows[0], "status");
    }

    private async Task<string> StoreAsync(CancellationToken ct)
    {
        if (_storeId is not null) return _storeId;
        using var json = await SendAsync(HttpMethod.Get, "products/stores", null, ct);
        var stores = Rows(json.RootElement, "stores");
        if (!string.IsNullOrWhiteSpace(_options.StoreId))
        {
            if (!stores.Any(s => string.Equals(Text(s, "id"), _options.StoreId, StringComparison.OrdinalIgnoreCase)))
                throw new NavkoloUnavailableException("Налаштований Navkolo StoreId не знайдено серед доступних складів.");
            return _storeId = _options.StoreId;
        }
        if (stores.Count != 1) throw new NavkoloUnavailableException("У Navkolo кілька складів або немає доступних. Задайте Navkolo:StoreId.");
        return _storeId = Required(stores[0], "id");
    }

    public async Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct)
    {
        var store = await StoreAsync(ct);
        var result = new List<NavkoloProductRecord>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var offset = 0; offset < 1_000_000; offset += 100)
        {
            using var json = await SendAsync(HttpMethod.Post,
                $"products/list?limit=100&offset={offset}&store_id={Uri.EscapeDataString(store)}&website_synch=1", new { }, ct);
            var rows = Rows(json.RootElement, "products");
            foreach (var p in rows)
            {
                var id = Required(p, "product_id");
                if (!seen.Add(id)) throw new NavkoloUnavailableException("DNTrade повернув повторну сторінку товарів. Імпорт зупинено.");
                var currency = Text(p, "currency");
                if (currency is not ("UAH" or "980" or "грн"))
                    throw new NavkoloUnavailableException("Каталог DNTrade має бути в гривні (UAH).");
                if (Text(p, "store_id") is { } returnedStore && !string.Equals(returnedStore, store, StringComparison.OrdinalIgnoreCase))
                    throw new NavkoloUnavailableException("DNTrade повернув дані іншого складу.");
                if (Number(p, "is_weight", optional: true) != 0)
                    throw new NavkoloUnavailableException("Вагові товари поки не підтримуються кошиком. Вимкніть для них синхронізацію з сайтом.");
                var category = p.GetProperty("category");
                var images = p.TryGetProperty("images", out var imageList) && imageList.ValueKind == JsonValueKind.Array
                    ? imageList.EnumerateArray().Select(i => i.GetString()!).ToList() : [];
                if (Text(p, "image_path") is { Length: > 0 } main) images.Insert(0, main);
                result.Add(new NavkoloProductRecord(id.ToLowerInvariant(), Text(p, "sku") ?? Text(p, "code"), Required(p, "title"),
                    Required(category, "category_id"), Number(p, "price"), null, Math.Max(0, Number(p, "balance") - Number(p, "booked")),
                    VariantGroup: Text(p, "parent_id"), VariantLabel: Text(p, "parent_id") is null ? null : Text(p, "title"),
                    Description: Text(p, "description"), ImageUrls: images.Distinct().ToArray(), GroupName: Required(category, "title")));
            }
            if (rows.Count < 100) return result;
        }
        throw new NavkoloUnavailableException("Перевищено ліміт сторінок каталогу DNTrade.");
    }

    public async Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct) =>
        (await GetCatalogAsync(ct)).Select(p => new PriceStockRecord(p.NavkoloId!, p.Price!.Value, p.OldPrice, p.Stock!.Value)).ToArray();

    public async Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct)
    {
        if (order.Id is not { } id || order.Lines.Any(l => !Guid.TryParse(l.NavkoloId, out _)))
            throw new NavkoloUnavailableException("Замовлення містить товари без UUID Navkolo. Спочатку синхронізуйте каталог.");
        var store = await StoreAsync(ct);
        var date = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(order.CreatedAt, "Europe/Kyiv").ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        var body = new Dictionary<string, object?>
        {
            ["id"] = id, ["private_id"] = order.Number, ["date"] = date, ["channel"] = _options.Channel,
            // The site owns the reservation; creating a second ERP reservation would double-subtract booked stock.
            ["reserve"] = 0,
            ["cart"] = order.Lines.Select(l => new { product_id = l.NavkoloId, store_id = store, price = l.UnitPrice, quantity = l.Quantity }).ToArray(),
            ["personal_info"] = new { name = order.CustomerName, phone = order.CustomerPhone,
                comment = $"{order.Number}. Оплата: {order.Payment}. {order.Comment}", delivery_title = order.Delivery },
        };
        if (_options.OrderStatusId is { } status) body["status"] = status;
        using var json = await SendAsync(HttpMethod.Post, "orders/upload", body, ct);
        var reference = Required(json.RootElement.GetProperty("data"), "id");
        if (!Guid.TryParse(reference, out var returned) || returned != id)
            throw new NavkoloUnavailableException("DNTrade повернув інший ідентифікатор замовлення.");
        return reference;
    }

    public async Task<IReadOnlyList<ExternalOrderState>> GetOrderStatesAsync(CancellationToken ct)
    {
        var statuses = await GetStatusesAsync(ct);
        var cancellation = statuses.SingleOrDefault(s => s.Id == _options.CancellationStatusId)
            ?? throw new NavkoloUnavailableException("Оберіть чинний статус скасування в Налаштування → Навколо.");
        if (statuses.Count(s => s.Name == cancellation.Name) != 1)
            throw new NavkoloUnavailableException("Назва статусу скасування в Навколо має бути унікальною.");
        var states = new List<ExternalOrderState>();
        var seen = new HashSet<Guid>();
        for (var offset = 0; offset < 1_000_000; offset += 50)
        {
            using var json = await SendAsync(HttpMethod.Get,
                $"orders/list?limit=50&offset={offset}&channel={Uri.EscapeDataString(_options.Channel)}", null, ct);
            var rows = Rows(json.RootElement, "orders");
            foreach (var row in rows)
            {
                if (Required(row, "channel") != _options.Channel) continue;
                if (!Guid.TryParse(Required(row, "external_id"), out var id) || id == Guid.Empty || !seen.Add(id))
                    throw new NavkoloUnavailableException("Некоректний або повторний ідентифікатор замовлення DNTrade. Звірку буде повторено.");
                var load = Number(row, "load");
                if (load is not (0 or 1)) throw new NavkoloUnavailableException("Невідомий стан відвантаження DNTrade.");
                var status = Required(row, "status");
                var cancelled = status == cancellation.Name || status == cancellation.Id.ToString(CultureInfo.InvariantCulture);
                if (load == 1 || cancelled) states.Add(new(id, load == 1, cancelled));
            }
            if (rows.Count < 50) return states;
        }
        throw new NavkoloUnavailableException("Перевищено ліміт сторінок замовлень DNTrade.");
    }

    internal static List<JsonElement> Rows(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var rows) || rows.ValueKind != JsonValueKind.Array)
            throw new NavkoloUnavailableException($"Некоректний список {name} у відповіді DNTrade.");
        return rows.EnumerateArray().ToList();
    }

    internal static string? Text(JsonElement row, string field) => row.TryGetProperty(field, out var v) && v.ValueKind != JsonValueKind.Null ? v.ToString() : null;
    internal static string Required(JsonElement row, string field) => Text(row, field) is { Length: > 0 } value
        ? value : throw new NavkoloUnavailableException($"У відповіді DNTrade немає {field}.");
    internal static decimal Number(JsonElement row, string field, bool optional = false)
    {
        var value = Text(row, field);
        if (optional && value is null) return 0;
        return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var n) ? n
            : throw new NavkoloUnavailableException($"Некоректне число {field} у відповіді DNTrade.");
    }
}
