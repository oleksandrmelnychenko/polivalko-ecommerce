using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace PoliValko.Infrastructure.Storefront;

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
