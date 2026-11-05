using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Brands;

internal static class DeleteBrand
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        IAuditLog audit,
        CancellationToken ct)
    {
        var brand = await db.Set<Brand>().FirstOrDefaultAsync(b => b.Id == id, ct);
        if (brand is null)
        {
            return BrandEditor.NotFound();
        }

        var productCount = await BrandEditor.CountProductsAsync(db, brand.NormalizedName, ct);
        if (productCount > 0)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "brands.in_use",
                "Бренд має товари",
                $"Товарів цього бренду: {productCount}. Об'єднайте його з іншим брендом або змініть бренд у товарах.",
                [new("productCount", productCount)]);
        }

        db.Remove(brand);
        audit.Record("catalog.brand_deleted", "Brand", brand.Slug, new { brand.Name });
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }
}
