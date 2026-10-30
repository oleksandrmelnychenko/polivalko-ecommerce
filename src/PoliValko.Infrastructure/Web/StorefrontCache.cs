using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace PoliValko.Infrastructure.Web;

public sealed class StorefrontOptions
{
    /// <summary>Внутрішня адреса маршруту ревалідації Next.js, напр. <c>http://web:3000/internal/revalidate</c>.</summary>
    public string? RevalidateUrl { get; set; }

    public string? RevalidateSecret { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(RevalidateUrl) && !string.IsNullOrWhiteSpace(RevalidateSecret);
}

/// <summary>
/// Скидає кеш вітрини за тегами після змін в адмінці, імпорту чи синхронізації цін.
/// Збій не ламає операцію: вітрина однаково оновиться за <c>cacheLife</c>.
/// </summary>
public interface IStorefrontCache
{
    Task InvalidateAsync(IReadOnlyCollection<string> tags, CancellationToken ct);
}

public static class StorefrontTags
{
    public const string Catalog = "catalog";
    public const string Products = "products";
    public const string Categories = "categories";
    public const string Collections = "collections";
    public const string Content = "content";
    public const string Delivery = "delivery";

    public static string Product(string slug) => $"product:{slug}";

    public static string Category(string slug) => $"category:{slug}";

    public static string Page(string slug) => $"page:{slug}";
}

internal sealed class StorefrontCache(HttpClient http, IOptions<StorefrontOptions> options, ILogger<StorefrontCache> logger) : IStorefrontCache
{
    public async Task InvalidateAsync(IReadOnlyCollection<string> tags, CancellationToken ct)
    {
        var settings = options.Value;
        if (!settings.IsConfigured || tags.Count == 0)
        {
            return;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, settings.RevalidateUrl)
            {
                Content = JsonContent.Create(new { tags }),
            };
            request.Headers.Add("x-revalidate-secret", settings.RevalidateSecret);
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Кеш вітрини не скинуто: {Status}", (int)response.StatusCode);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Кеш вітрини не скинуто: вітрина недоступна");
        }
    }
}
