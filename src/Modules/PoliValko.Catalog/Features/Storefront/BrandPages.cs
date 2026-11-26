using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Storefront;

/// <summary>
/// A brand gets its own storefront page once enough of its visible products have a photo to make a page worth
/// showing to search engines. The same rule decides the page, the brand list, the sitemap and the link from a product,
/// so a link never leads to a missing page.
/// </summary>
internal static class BrandPages
{
    public const int MinProductsWithPhoto = 5;

    /// <param name="Names">Every spelling of the brand on products («GARDENA», «Gardena»).</param>
    internal sealed record Page(Brand Brand, IReadOnlyList<string> Names, int ProductCount, DateTimeOffset UpdatedAt);

    public static async Task<List<Page>> LoadAsync(PoliValkoDbContext db, IQueryable<Product> visibleProducts, CancellationToken ct)
    {
        var counts = await visibleProducts
            .Where(p => p.Brand != null)
            .GroupBy(p => p.Brand!)
            .Select(g => new
            {
                Name = g.Key,
                Count = g.Count(),
                Product = g.Max(p => p.UpdatedAt),
                Price = g.Max(p => p.Price.UpdatedAt),
            })
            .ToListAsync(ct);
        var withPhoto = await visibleProducts
            .Where(p => p.Brand != null && p.Images.Any())
            .GroupBy(p => p.Brand!)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Name, x => x.Count, ct);
        var brands = await db.Set<Brand>().AsNoTracking().ToListAsync(ct);
        var byName = brands.ToDictionary(b => b.NormalizedName);

        return counts
            .GroupBy(c => Brand.Normalize(c.Name))
            .Where(g => byName.ContainsKey(g.Key) && g.Sum(c => withPhoto.GetValueOrDefault(c.Name)) >= MinProductsWithPhoto)
            .Select(g => new Page(
                byName[g.Key],
                g.Select(c => c.Name).Order(StringComparer.Ordinal).ToList(),
                g.Sum(c => c.Count),
                g.Max(c => c.Product > c.Price ? c.Product : c.Price)))
            .OrderByDescending(p => p.ProductCount)
            .ThenBy(p => p.Brand.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    public static async Task<Ok<List<BrandSummaryDto>>> ListAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var pages = await LoadAsync(db, await CatalogVisibility.ProductsAsync(db, ct), ct);
        return TypedResults.Ok(pages.Select(p => new BrandSummaryDto(p.Brand.Name, p.Brand.Slug, p.Brand.LogoUrl, p.ProductCount)).ToList());
    }

    public static async Task<Results<Ok<BrandPageDto>, ProblemHttpResult>> GetAsync(string slug, PoliValkoDbContext db, CancellationToken ct)
    {
        var pages = await LoadAsync(db, await CatalogVisibility.ProductsAsync(db, ct), ct);
        var page = pages.FirstOrDefault(p => p.Brand.Slug == slug);
        if (page is null) return NotFound(slug);
        return TypedResults.Ok(new BrandPageDto(
            page.Brand.Name, page.Brand.Slug, page.Brand.Description, page.Brand.LogoUrl, page.ProductCount, page.UpdatedAt));
    }

    /// <summary>The spellings of a brand page's brand on products, or null when the brand has no page.</summary>
    public static async Task<IReadOnlyList<string>?> NamesAsync(PoliValkoDbContext db, IQueryable<Product> visibleProducts, string slug, CancellationToken ct) =>
        (await LoadAsync(db, visibleProducts, ct)).FirstOrDefault(p => p.Brand.Slug == slug)?.Names;

    /// <summary>The page slug for a product's brand, or null when the brand has no page.</summary>
    public static async Task<string?> SlugForAsync(PoliValkoDbContext db, IQueryable<Product> visibleProducts, string? brand, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(brand)) return null;
        // A product page asks for one brand: count only its products instead of loading every brand.
        var normalized = Brand.Normalize(brand);
        var slug = await db.Set<Brand>().AsNoTracking().Where(b => b.NormalizedName == normalized).Select(b => b.Slug).FirstOrDefaultAsync(ct);
        if (slug is null) return null;
        var withPhoto = await visibleProducts.CountAsync(p => p.Brand != null && p.Brand.Trim().ToUpper() == normalized && p.Images.Any(), ct);
        return withPhoto >= MinProductsWithPhoto ? slug : null;
    }

    public static ProblemHttpResult NotFound(string slug) =>
        Problems.NotFound("catalog.brand_not_found", "Бренд не знайдено", $"Сторінки бренду '{slug}' немає.");
}
