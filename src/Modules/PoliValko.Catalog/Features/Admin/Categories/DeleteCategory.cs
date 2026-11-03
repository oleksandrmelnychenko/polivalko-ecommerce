using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Admin.Categories;

internal static class DeleteCategory
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var category = await db.Set<Category>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null)
        {
            return CategoryEditor.CategoryNotFound();
        }

        if (category.ParentId is null)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "catalog.category_top_level", "Розділ верхнього рівня не видаляється", "Його можна приховати.");
        }

        if (await db.Set<Category>().AnyAsync(c => c.ParentId == id, ct) || await db.Set<Product>().AnyAsync(p => p.CategoryId == id, ct))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "catalog.category_not_empty", "Розділ не порожній", "Спочатку перенесіть товари й підрозділи.");
        }

        db.Remove(category);
        audit.Record("catalog.category_deleted", "Category", category.Slug, new { category.Name });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Categories], ct);
        return TypedResults.NoContent();
    }
}
