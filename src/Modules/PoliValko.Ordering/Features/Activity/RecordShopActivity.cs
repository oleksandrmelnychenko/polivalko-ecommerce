using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Cart;

namespace PoliValko.Ordering.Features.Activity;

public sealed record RecordShopActivityRequest(string Kind, Guid ProductId);

internal static class RecordShopActivity
{
    public static async Task<NoContent> HandleAsync(
        RecordShopActivityRequest request,
        HttpContext http,
        PoliValkoDbContext db,
        ServerCartStore store,
        ICatalogPricing pricing,
        ShopActivityHub hub,
        TimeProvider time,
        CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-store";
        if (string.Equals(http.Request.Headers["Sec-Fetch-Site"], "cross-site", StringComparison.OrdinalIgnoreCase))
        {
            return TypedResults.NoContent();
        }

        if (!ShopActivityKinds.IsStorefrontSignal(request.Kind) || request.ProductId == Guid.Empty)
        {
            return TypedResults.NoContent();
        }

        var products = await pricing.GetAsync([request.ProductId], ct);
        if (!products.TryGetValue(request.ProductId, out var product) || !product.IsVisible)
        {
            return TypedResults.NoContent();
        }

        var now = time.GetUtcNow();
        var owner = store.Owner(http);
        db.Add(ShopActivityRecorder.Create(request.Kind, owner, request.ProductId, 1, http.Request, now));
        await db.SaveChangesAsync(ct);
        await ShopActivityRecorder.TrimExpiredOccasionallyAsync(db, now, ct);
        hub.Publish();
        return TypedResults.NoContent();
    }
}
