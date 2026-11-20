using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PoliValko.Console.Features.Analytics;

internal sealed class ProductAnalyticsClient(HttpClient http, IConfiguration configuration, ILogger<ProductAnalyticsClient> logger)
{
    private const int MaxRequestBytes = 64 * 1024 * 1024;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { NumberHandling = JsonNumberHandling.Strict };
    private readonly Uri? _endpoint = ResolveEndpoint(configuration["ProductAnalytics:BaseUrl"]);

    public bool IsConfigured => _endpoint is not null;

    public async Task<ProductAnalyticsDto?> BuildAsync(ProductAnalyticsRequest request, CancellationToken ct)
    {
        if (_endpoint is null) return null;

        var body = JsonSerializer.SerializeToUtf8Bytes(request, Json);
        if (body.Length > MaxRequestBytes)
        {
            logger.LogWarning("Product analytics request size {Bytes} exceeds the service limit", body.Length);
            return null;
        }

        using var content = new ByteArrayContent(body);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        try
        {
            using var response = await http.PostAsync(_endpoint, content, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Product analytics service returned HTTP {Status}", (int)response.StatusCode);
                return null;
            }

            var report = await response.Content.ReadFromJsonAsync<ProductAnalyticsDto>(Json, ct);
            if (report is null || report.Source != request.Source || report.From != request.From || report.To != request.To ||
                report.PreviousFrom != request.PreviousFrom || report.PreviousTo != request.From.AddDays(-1) ||
                report.Coverage is null || report.Inventory is null || report.Metrics is null || report.Trend is null ||
                report.Products?.Items is null || report.Insights is null)
            {
                logger.LogWarning("Product analytics service returned an incomplete report");
                return null;
            }

            return report;
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or IOException ||
            (error is OperationCanceledException && !ct.IsCancellationRequested))
        {
            logger.LogWarning("Product analytics service request failed ({ErrorType})", error.GetType().Name);
            return null;
        }
    }

    private static Uri? ResolveEndpoint(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var address) && address.Scheme is "http" or "https" &&
        address.Host.Length > 0 && address.UserInfo.Length == 0 && address.Query.Length == 0 && address.Fragment.Length == 0
            ? new Uri(address, "/v1/product-analytics") : null;
}
