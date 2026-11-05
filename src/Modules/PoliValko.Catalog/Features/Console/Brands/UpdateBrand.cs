using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Console.Brands;

internal static class UpdateBrand
{
    public static async Task<Results<Ok<BrandDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        SaveBrandRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var brand = await db.Set<Brand>().FirstOrDefaultAsync(b => b.Id == id, ct);
        if (brand is null)
        {
            return BrandEditor.NotFound();
        }

        var before = new { brand.Name, brand.Slug };
        var oldNormalized = brand.NormalizedName;
        var errors = await BrandEditor.ApplyAsync(brand, request, db, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var products = 0;
        if (!string.Equals(before.Name, brand.Name, StringComparison.Ordinal))
        {
            var name = brand.Name;
            var now = time.GetUtcNow();
            products = await BrandEditor.Products(db, oldNormalized)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Brand, name).SetProperty(p => p.UpdatedAt, now), ct);
        }

        audit.Record("catalog.brand_updated", "Brand", brand.Slug, new { before, after = new { brand.Name, brand.Slug }, products });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        if (products > 0)
        {
            await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Products, StorefrontTags.Collections], ct);
        }

        return TypedResults.Ok(await BrandEditor.ToDtoAsync(db, brand, ct));
    }
}
