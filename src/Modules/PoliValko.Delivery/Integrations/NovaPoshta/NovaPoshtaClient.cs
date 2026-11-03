using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Delivery.Configuration;
using PoliValko.Delivery.Contracts;

namespace PoliValko.Delivery.Integrations.NovaPoshta;

internal sealed class NovaPoshtaClient(
    HttpClient http,
    IOptions<NovaPoshtaOptions> options,
    TimeProvider time,
    ILogger<NovaPoshtaClient> logger)
{
    public const int MaxPages = 1000;

    private static readonly TimeSpan MaxRetryAfter = TimeSpan.FromMinutes(2);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyDictionary<string, string>> GetAreasAsync(CancellationToken ct)
    {
        var page = await CallAsync("Address", "getAreas", new Dictionary<string, string>(), NovaPoshtaMapper.MapArea, ct);
        return page.Items.DistinctBy(a => a.Ref, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(a => a.Ref, a => a.Name, StringComparer.OrdinalIgnoreCase);
    }

    public IAsyncEnumerable<IReadOnlyList<Settlement>> GetCityPagesAsync(IReadOnlyDictionary<string, string> areas, CancellationToken ct) =>
        GetPagesAsync("Address", "getCities", element => NovaPoshtaMapper.MapCity(element, areas), ct);

    public IAsyncEnumerable<IReadOnlyList<Warehouse>> GetWarehousePagesAsync(CancellationToken ct) =>
        GetPagesAsync("AddressGeneral", "getWarehouses", NovaPoshtaMapper.MapWarehouse, ct);

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

            if (result.RawCount == 0
                || (result.TotalCount is { } total ? received >= total : result.RawCount < pageSize))
            {
                yield break;
            }
        }

        throw new NovaPoshtaException($"Нова пошта: {model}.{method} повертає понад {MaxPages} сторінок; синхронізацію зупинено.");
    }

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
                return NovaPoshtaResponseParser.Parse(document.RootElement, name, map);
            }
        }
    }

    private TimeSpan? RetryAfter(HttpResponseMessage response)
    {
        var header = response.Headers.RetryAfter;
        var delay = header?.Delta ?? (header?.Date is { } date ? date - time.GetUtcNow() : null);
        return delay is { } value ? TimeSpan.FromTicks(Math.Clamp(value.Ticks, 0, MaxRetryAfter.Ticks)) : null;
    }

    private Task DelayAsync(TimeSpan delay, CancellationToken ct) =>
        delay > TimeSpan.Zero ? Task.Delay(delay, time, ct) : Task.CompletedTask;
}
