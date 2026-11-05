using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Brands;

internal static class CreateBrand
{
    public static async Task<Results<Created<BrandDto>, ValidationProblem>> HandleAsync(
        SaveBrandRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        CancellationToken ct)
    {
        var brand = new Brand { Id = Guid.CreateVersion7(), Slug = string.Empty };
        var errors = await BrandEditor.ApplyAsync(brand, request, db, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        db.Add(brand);
        audit.Record("catalog.brand_created", "Brand", brand.Slug, new { brand.Name });
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/v1/console/catalog/brands/{brand.Id}", await BrandEditor.ToDtoAsync(db, brand, ct));
    }
}
