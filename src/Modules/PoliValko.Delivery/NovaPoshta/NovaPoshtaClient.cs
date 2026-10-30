using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Delivery.Persistence;

namespace PoliValko.Delivery.NovaPoshta;

/// <summary>
/// Помилка виклику API Нової пошти. Текст потрапляє в стан синхронізації в адмінці,
/// тому ключа API в ньому ніколи немає.
/// </summary>
internal sealed class NovaPoshtaException(
    string message,
    bool isTransient = false,
    TimeSpan? retryAfter = null,
    Exception? innerException = null) : Exception(message, innerException)
{
    /// <summary>Тимчасовий збій (мережа, HTTP 429/5xx, ліміт запитів): запит варто повторити.</summary>
    public bool IsTransient { get; } = isTransient;

    public TimeSpan? RetryAfter { get; } = retryAfter;
}

internal sealed record NovaPoshtaArea(string Ref, string Name);

/// <summary>Сторінка відповіді: розібрані записи, скільки записів прийшло до фільтрації, і загальна кількість від API.</summary>
internal sealed record NovaPoshtaPage<T>(IReadOnlyList<T> Items, int RawCount, int? TotalCount);

/// <summary>
/// Клієнт API Нової пошти 2.0: POST JSON <c>{apiKey, modelName, calledMethod, methodProperties}</c>
/// на <c>Delivery:NovaPoshta:BaseUrl</c>; відповідь — <c>{success, data, errors, warnings, info}</c>.
/// <para>
/// Пара методів довідника: <c>Address.getCities</c> (населені пункти, де працює НП) і
/// <c>AddressGeneral.getWarehouses</c> (відділення й поштомати). Вони узгоджено з'єднуються через
/// <c>CityRef</c> відділення = <c>Ref</c> з getCities. <c>AddressGeneral.getSettlements</c> не
/// використовуємо: його Ref відповідають <c>SettlementRef</c> відділення, а не <c>CityRef</c>,
/// і змішування двох довідників дає «міста без відділень».
/// </para>
/// </summary>
internal sealed class NovaPoshtaClient(
    HttpClient http,
    IOptions<NovaPoshtaOptions> options,
    TimeProvider time,
    ILogger<NovaPoshtaClient> logger)
{
    /// <summary>Захист від нескінченного гортання, якщо API раптом ігнорує Page.</summary>
    public const int MaxPages = 1000;

    /// <summary>Ref типів відділень-поштоматів з <c>Address.getWarehouseTypes</c>.</summary>
    internal static readonly HashSet<string> PostomatTypeRefs = new(StringComparer.OrdinalIgnoreCase)
    {
        "95dc212d-479c-4ffb-a8ab-8c1b9073d0bc", // Поштомат
        "f9316480-5f2d-425d-bc2c-ac7cd29decf0", // Поштомат ПриватБанку
    };

    private static readonly TimeSpan MaxRetryAfter = TimeSpan.FromMinutes(2);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Області: Ref → назва. Потрібні, якщо getCities не віддав <c>AreaDescription</c>.</summary>
    public async Task<IReadOnlyDictionary<string, string>> GetAreasAsync(CancellationToken ct)
    {
        var page = await CallAsync("Address", "getAreas", new Dictionary<string, string>(), MapArea, ct);
        return page.Items.DistinctBy(a => a.Ref, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(a => a.Ref, a => a.Name, StringComparer.OrdinalIgnoreCase);
    }

    public IAsyncEnumerable<IReadOnlyList<Settlement>> GetCityPagesAsync(IReadOnlyDictionary<string, string> areas, CancellationToken ct) =>
        GetPagesAsync("Address", "getCities", element => MapCity(element, areas), ct);

    /// <summary>Сторінки робочих відділень і поштоматів; <see cref="Warehouse.SettlementRef"/> — це CityRef.</summary>
    public IAsyncEnumerable<IReadOnlyList<Warehouse>> GetWarehousePagesAsync(CancellationToken ct) =>
        GetPagesAsync("AddressGeneral", "getWarehouses", MapWarehouse, ct);

    private async IAsyncEnumerable<IReadOnlyList<T>> GetPagesAsync<T>(
        string model,
        string method,
        Func<JsonElement, T?> map,
        [EnumeratorCancellation] CancellationToken ct)
        where T : class
    {
        var settings = options.Value;
        var pageSize = Math.Max(settings.PageSize, 1);
        var received = 0;
        for (var page = 1; page <= MaxPages; page++)
        {
            ct.ThrowIfCancellationRequested();
            if (page > 1)
            {
                await DelayAsync(settings.PageDelay, ct);
            }

            var result = await CallAsync(
                model,
                method,
                new Dictionary<string, string>
                {
                    ["Page"] = page.ToString(CultureInfo.InvariantCulture),
                    ["Limit"] = pageSize.ToString(CultureInfo.InvariantCulture),
                },
                map,
                ct);
            received += result.RawCount;
            if (result.Items.Count > 0)
            {
                yield return result.Items;
            }

            // Якщо API повідомив загальну кількість — гортаємо до неї (на випадок, коли він урізає Limit);
            // інакше неповна сторінка означає кінець.
            if (result.RawCount == 0
                || (result.TotalCount is { } total ? received >= total : result.RawCount < pageSize))
            {
                yield break;
            }
        }

        throw new NovaPoshtaException($"Нова пошта: {model}.{method} повертає понад {MaxPages} сторінок; синхронізацію зупинено.");
    }

    /// <summary>Один виклик методу API з повторами після тимчасових збоїв.</summary>
    internal async Task<NovaPoshtaPage<T>> CallAsync<T>(
        string model,
        string method,
        Dictionary<string, string> properties,
        Func<JsonElement, T?> map,
        CancellationToken ct)
        where T : class
    {
        var settings = options.Value;
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                return await SendAsync(settings, model, method, properties, map, ct);
            }
            catch (NovaPoshtaException ex) when (ex.IsTransient && attempt < settings.MaxRetries)
            {
                var delay = ex.RetryAfter ?? TimeSpan.FromTicks(settings.RetryDelay.Ticks * (1L << Math.Min(attempt, 10)));
                logger.LogWarning(
                    "Нова пошта {Model}.{Method}: {Error} Повтор {Attempt} через {Delay}.",
                    model,
                    method,
                    ex.Message,
                    attempt + 1,
                    delay);
                await DelayAsync(delay, ct);
            }
        }
    }

    private async Task<NovaPoshtaPage<T>> SendAsync<T>(
        NovaPoshtaOptions settings,
        string model,
        string method,
        Dictionary<string, string> properties,
        Func<JsonElement, T?> map,
        CancellationToken ct)
        where T : class
    {
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
        {
            throw new NovaPoshtaException("Не задано ключ API Нової пошти (Delivery:NovaPoshta:ApiKey).");
        }

        var name = $"{model}.{method}";
        var body = JsonSerializer.SerializeToUtf8Bytes(new NovaPoshtaRequest(settings.ApiKey, model, method, properties), Json);

        // Порожній RequestUri — запит іде на BaseAddress клієнта (Delivery:NovaPoshta:BaseUrl).
        using var request = new HttpRequestMessage(HttpMethod.Post, (Uri?)null) { Content = new ByteArrayContent(body) };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new NovaPoshtaException($"Нова пошта недоступна ({name}): {ex.Message}", isTransient: true, innerException: ex);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new NovaPoshtaException($"Нова пошта не відповіла вчасно ({name}).", isTransient: true, innerException: ex);
        }

        using (response)
        {
            var status = (int)response.StatusCode;
            if (response.StatusCode == HttpStatusCode.TooManyRequests || status >= 500)
            {
                throw new NovaPoshtaException(
                    $"Нова пошта тимчасово не приймає запити ({name}): HTTP {status}.",
                    isTransient: true,
                    retryAfter: RetryAfter(response));
            }

            if (!response.IsSuccessStatusCode)
            {
                throw new NovaPoshtaException($"Нова пошта відхилила запит {name}: HTTP {status}.");
            }

            JsonDocument document;
            try
            {
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            }
            catch (JsonException ex)
            {
                throw new NovaPoshtaException($"Нова пошта повернула некоректну відповідь ({name}).", innerException: ex);
            }

            using (document)
            {
                return Parse(document.RootElement, name, map);
            }
        }
    }

    /// <summary>Розбирає відповідь: перевіряє <c>success</c>/<c>errors</c>, мапить <c>data</c>, читає <c>info.totalCount</c>.</summary>
    internal static NovaPoshtaPage<T> Parse<T>(JsonElement root, string name, Func<JsonElement, T?> map)
        where T : class
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new NovaPoshtaException($"Нова пошта повернула некоректну відповідь ({name}).");
        }

        var success = root.TryGetProperty("success", out var flag)
                      && (flag.ValueKind == JsonValueKind.True
                          || (flag.ValueKind == JsonValueKind.String && string.Equals(flag.GetString(), "true", StringComparison.OrdinalIgnoreCase)));
        if (!success)
        {
            var errors = Messages(root, "errors");
            var text = errors.Count > 0 ? string.Join("; ", errors) : "без опису помилки";
            throw new NovaPoshtaException(
                NovaPoshtaText.Truncate($"Нова пошта відхилила запит {name}: {text}", 1000),
                isTransient: errors.Any(IsRateLimitMessage));
        }

        var items = new List<T>();
        var raw = 0;
        if (root.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
        {
            foreach (var element in data.EnumerateArray())
            {
                raw++;
                if (element.ValueKind == JsonValueKind.Object && map(element) is { } item)
                {
                    items.Add(item);
                }
            }
        }

        return new NovaPoshtaPage<T>(items, raw, TotalCount(root));
    }

    internal static NovaPoshtaArea? MapArea(JsonElement element) =>
        Text(element, "Ref") is { } reference && Text(element, "Description") is { } name
            ? new NovaPoshtaArea(reference, name)
            : null;

    internal static Settlement? MapCity(JsonElement element, IReadOnlyDictionary<string, string> areas)
    {
        var reference = Text(element, "Ref");
        var name = Text(element, "Description");
        if (reference is null || name is null || reference.Length > DeliveryLimits.RefLength)
        {
            return null;
        }

        var area = Text(element, "AreaDescription")
                   ?? (Text(element, "Area") is { } areaRef && areas.TryGetValue(areaRef, out var areaName) ? areaName : null);
        return new Settlement(
            reference,
            NovaPoshtaText.Truncate(name, DeliveryLimits.SettlementNameLength),
            NovaPoshtaText.Truncate(FormatArea(area), DeliveryLimits.AreaLength));
    }

    /// <summary>
    /// Робоче відділення чи поштомат; null — запис неповний, відділення не працює
    /// (<c>WarehouseStatus</c> ≠ Working) або недоступне для вибору отримувачем (<c>DenyToSelect</c>).
    /// </summary>
    internal static Warehouse? MapWarehouse(JsonElement element)
    {
        var reference = Text(element, "Ref");
        var cityRef = Text(element, "CityRef");
        var description = Text(element, "Description");
        if (reference is null || cityRef is null || description is null
            || reference.Length > DeliveryLimits.RefLength || cityRef.Length > DeliveryLimits.RefLength)
        {
            return null;
        }

        if (Text(element, "WarehouseStatus") is { } status && !status.Equals("Working", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (Text(element, "DenyToSelect") == "1")
        {
            return null;
        }

        var isPostomat = (Text(element, "CategoryOfWarehouse") is { } category && category.Equals("Postomat", StringComparison.OrdinalIgnoreCase))
                         || (Text(element, "TypeOfWarehouse") is { } typeRef && PostomatTypeRefs.Contains(typeRef));
        var number = int.TryParse(Text(element, "Number"), NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;
        var (name, address) = SplitDescription(description, Text(element, "ShortAddress"));

        return new Warehouse(
            reference,
            cityRef,
            number,
            NovaPoshtaText.Truncate(name, DeliveryLimits.WarehouseNameLength),
            NovaPoshtaText.Truncate(address, DeliveryLimits.WarehouseAddressLength),
            isPostomat ? WarehouseType.Postomat : WarehouseType.Branch);
    }

    /// <summary>«Відділення №1: вул. Пирогівський шлях, 135» → («Відділення №1», «вул. Пирогівський шлях, 135»).</summary>
    internal static (string Name, string Address) SplitDescription(string description, string? shortAddress)
    {
        var colon = description.IndexOf(':');
        if (colon > 0)
        {
            var name = description[..colon].Trim();
            var address = description[(colon + 1)..].Trim();
            if (name.Length > 0 && address.Length > 0)
            {
                return (name, address);
            }
        }

        return (description, shortAddress ?? string.Empty);
    }

    /// <summary>«Київська» → «Київська обл.»; інші назви (з «обл.» чи без прикметника) — як є.</summary>
    internal static string FormatArea(string? area) =>
        string.IsNullOrWhiteSpace(area) ? string.Empty
        : area.EndsWith("ька", StringComparison.Ordinal) ? $"{area} обл."
        : area;

    private static string? Text(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value))
        {
            return null;
        }

        var text = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
        text = text?.Trim();
        return string.IsNullOrEmpty(text) ? null : text;
    }

    /// <summary><c>errors</c> буває масивом рядків або об'єктом «код → текст».</summary>
    private static List<string> Messages(JsonElement root, string property)
    {
        var result = new List<string>();
        if (!root.TryGetProperty(property, out var value))
        {
            return result;
        }

        var values = value.ValueKind switch
        {
            JsonValueKind.Array => value.EnumerateArray().ToList(),
            JsonValueKind.Object => value.EnumerateObject().Select(p => p.Value).ToList(),
            JsonValueKind.String => [value],
            _ => [],
        };
        foreach (var item in values)
        {
            if (item.ValueKind == JsonValueKind.String && item.GetString() is { Length: > 0 } text)
            {
                result.Add(text.Trim());
            }
        }

        return result;
    }

    /// <summary><c>info</c> у НП буває об'єктом <c>{"totalCount": N}</c> або порожнім масивом.</summary>
    private static int? TotalCount(JsonElement root)
    {
        if (!root.TryGetProperty("info", out var info) || info.ValueKind != JsonValueKind.Object
            || !info.TryGetProperty("totalCount", out var total))
        {
            return null;
        }

        return total.ValueKind switch
        {
            JsonValueKind.Number when total.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(total.GetString(), NumberStyles.None, CultureInfo.InvariantCulture, out var number) => number,
            _ => null,
        };
    }

    private static bool IsRateLimitMessage(string message) =>
        message.Contains("many requests", StringComparison.OrdinalIgnoreCase)
        || message.Contains("rate limit", StringComparison.OrdinalIgnoreCase)
        || message.Contains("ліміт", StringComparison.OrdinalIgnoreCase);

    private TimeSpan? RetryAfter(HttpResponseMessage response)
    {
        var header = response.Headers.RetryAfter;
        var delay = header?.Delta ?? (header?.Date is { } date ? date - time.GetUtcNow() : null);
        return delay is { } value ? TimeSpan.FromTicks(Math.Clamp(value.Ticks, 0, MaxRetryAfter.Ticks)) : null;
    }

    private Task DelayAsync(TimeSpan delay, CancellationToken ct) =>
        delay > TimeSpan.Zero ? Task.Delay(delay, time, ct) : Task.CompletedTask;

    private sealed record NovaPoshtaRequest(
        string ApiKey,
        string ModelName,
        string CalledMethod,
        Dictionary<string, string> MethodProperties);
}
