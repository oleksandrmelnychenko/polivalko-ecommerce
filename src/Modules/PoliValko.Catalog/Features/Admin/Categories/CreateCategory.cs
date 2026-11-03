using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Admin.Categories;

internal static class CreateCategory
{
    public static async Task<Results<Created<AdminCategoryDto>, ValidationProblem>> HandleAsync(
        SaveCategoryRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.ParentId is null)
        {
            errors["parentId"] = ["Оберіть батьківський розділ: верхній рівень відповідає групам Navkolo."];
        }

        var category = new Category { Id = Guid.CreateVersion7(), Name = string.Empty, Slug = string.Empty };
        await CategoryEditor.ApplyCategoryAsync(category, request, isNew: true, db, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        db.Add(category);
        audit.Record("catalog.category_created", "Category", category.Slug, new { category.Name, category.ParentId, category.NavkoloRef });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Categories], ct);
        return TypedResults.Created($"/api/v1/admin/catalog/categories/{category.Id}", CategoryEditor.ToDto(category, 0));
    }
}
