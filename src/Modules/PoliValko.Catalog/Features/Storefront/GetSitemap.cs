using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

internal static class GetSitemap
{
    public static async Task<Ok<SitemapDto>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var visibleProducts = await CatalogVisibility.ProductsAsync(db, ct);
        var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
        var products = await visibleProducts
            .AsNoTracking()
            .Where(p => p.IsVisible)
            .OrderBy(p => p.Slug)
            .Select(p => new SitemapEntryDto(p.Slug, p.UpdatedAt > p.Price.UpdatedAt ? p.UpdatedAt : p.Price.UpdatedAt))
            .ToListAsync(ct);
        var latest = products.Count > 0 ? products.Max(p => p.UpdatedAt) : DateTimeOffset.UnixEpoch;

        return TypedResults.Ok(new SitemapDto(categories.Select(c => new SitemapEntryDto(c.Slug, latest)).ToList(), products));
    }
}
