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
            // Search engines are offered a product once it has a photo; neither stock nor price matters. A product
            // without a photo stays reachable on the site, and the storefront marks its page noindex by the same rule
            // (isIndexableProduct in web/apps/shop). The storefront caches this list for hours, so a product that has
            // just lost its only photo can be listed and noindex until the cache refreshes.
            .Where(p => p.Images.Any())
            .OrderBy(p => p.Slug)
            .Select(p => new SitemapEntryDto(p.Slug, p.UpdatedAt > p.Price.UpdatedAt ? p.UpdatedAt : p.Price.UpdatedAt))
            .ToListAsync(ct);

        // A category page lists the visible products of the category and of everything under it, with or without a
        // photo, so it changed when the latest of them did. One date for every category would tell search engines
        // nothing; a category with no products at all keeps the catalog-wide date.
        var changes = await visibleProducts
            .AsNoTracking()
            .Where(p => p.IsVisible)
            .GroupBy(p => p.CategoryId)
            .Select(g => new { CategoryId = g.Key, Product = g.Max(p => p.UpdatedAt), Price = g.Max(p => p.Price.UpdatedAt) })
            .ToListAsync(ct);
        var changedIn = changes.ToDictionary(c => c.CategoryId, c => c.Product > c.Price ? c.Product : c.Price);
        var latest = changedIn.Count > 0 ? changedIn.Values.Max() : DateTimeOffset.UnixEpoch;
        var byParent = categories.ToLookup(c => c.ParentId);
        DateTimeOffset ChangedAt(Category category) => CategoryQueries.Descendants(category.Id, byParent).Prepend(category.Id)
            .Where(changedIn.ContainsKey).Select(id => changedIn[id]).DefaultIfEmpty(latest).Max();

        return TypedResults.Ok(new SitemapDto(categories.Select(c => new SitemapEntryDto(c.Slug, ChangedAt(c))).ToList(), products));
    }
}
