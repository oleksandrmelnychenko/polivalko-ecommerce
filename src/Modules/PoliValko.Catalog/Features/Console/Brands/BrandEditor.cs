using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Brands;

internal static class BrandEditor
{
    public static async Task<Dictionary<string, string[]>> ApplyAsync(Brand brand, SaveBrandRequest request, PoliValkoDbContext db, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > Brand.MaxNameLength)
        {
            errors["name"] = [$"Вкажіть назву до {Brand.MaxNameLength} символів."];
        }
        else
        {
            var normalized = Brand.Normalize(name);
            if (await db.Set<Brand>().AnyAsync(b => b.NormalizedName == normalized && b.Id != brand.Id, ct))
            {
                errors["name"] = ["Бренд з такою назвою вже є."];
            }
        }

        var slugs = await db.Set<Brand>().Where(b => b.Id != brand.Id).Select(b => b.Slug).ToListAsync(ct);
        var taken = slugs.ToHashSet(StringComparer.Ordinal);
        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? brand.Slug is { Length: > 0 } current && !taken.Contains(current) ? current : CatalogDictionarySync.UniqueSlug(name ?? string.Empty, new HashSet<string>(taken, StringComparer.Ordinal))
            : request.Slug.Trim().ToLowerInvariant();
        if (!CatalogConsoleValidation.IsSlug(slug) || slug.Length > 200)
        {
            errors["slug"] = ["Адреса має бути не довшою за 200 символів і містити лише латинські літери, цифри й дефіси."];
        }
        else if (taken.Contains(slug))
        {
            errors["slug"] = ["Така адреса вже зайнята іншим брендом."];
        }

        CatalogConsoleValidation.CheckLength(errors, "description", request.Description, 2000);
        var logo = CatalogConsoleValidation.NullIfEmpty(request.LogoUrl);
        if (logo is not null && !ImageUrls.IsValid(logo))
        {
            errors["logoUrl"] = [ImageUrls.InvalidMessage];
        }

        if (errors.Count > 0)
        {
            return errors;
        }

        brand.Rename(name!);
        brand.Slug = slug;
        brand.Description = CatalogConsoleValidation.NullIfEmpty(request.Description);
        brand.LogoUrl = logo;
        return errors;
    }

    public static async Task<Dictionary<string, int>> CountProductsAsync(PoliValkoDbContext db, CancellationToken ct) =>
        (await db.Set<Product>()
                .Where(p => p.Brand != null)
                .GroupBy(p => p.Brand!.Trim().ToUpper())
                .Select(g => new { g.Key, Count = g.Count() })
                .ToListAsync(ct))
            .GroupBy(x => Brand.Normalize(x.Key), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Count), StringComparer.Ordinal);

    public static Task<int> CountProductsAsync(PoliValkoDbContext db, string normalizedName, CancellationToken ct) =>
        Products(db, normalizedName).CountAsync(ct);

    public static IQueryable<Product> Products(PoliValkoDbContext db, string normalizedName) =>
        db.Set<Product>().Where(p => p.Brand != null && p.Brand.Trim().ToUpper() == normalizedName);

    public static async Task<BrandDto> ToDtoAsync(PoliValkoDbContext db, Brand brand, CancellationToken ct) =>
        ToDto(brand, await CountProductsAsync(db, brand.NormalizedName, ct));

    public static BrandDto ToDto(Brand b, int productCount) => new(b.Id, b.Name, b.Slug, b.Description, b.LogoUrl, productCount);

    public static ProblemHttpResult NotFound() => Problems.NotFound("catalog.brand_not_found", "Бренд не знайдено");
}
