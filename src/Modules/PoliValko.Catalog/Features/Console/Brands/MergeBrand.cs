using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Console.Brands;

internal static class MergeBrand
{
    public static async Task<Results<Ok<BrandDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        MergeBrandRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var source = await db.Set<Brand>().FirstOrDefaultAsync(b => b.Id == id, ct);
        if (source is null)
        {
            return BrandEditor.NotFound();
        }

        if (request.IntoId is not { } intoId || intoId == id)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["intoId"] = ["Оберіть інший бренд, з яким об'єднати."] });
        }

        var target = await db.Set<Brand>().FirstOrDefaultAsync(b => b.Id == intoId, ct);
        if (target is null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["intoId"] = ["Бренд, з яким об'єднати, не знайдено."] });
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var name = target.Name;
        var now = time.GetUtcNow();
        var moved = await BrandEditor.Products(db, source.NormalizedName)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Brand, name).SetProperty(p => p.UpdatedAt, now), ct);
        db.Remove(source);
        audit.Record("catalog.brand_merged", "Brand", target.Slug, new { from = source.Name, into = target.Name, products = moved });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        if (moved > 0)
        {
            await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Products, StorefrontTags.Collections], ct);
        }

        return TypedResults.Ok(await BrandEditor.ToDtoAsync(db, target, ct));
    }
}
