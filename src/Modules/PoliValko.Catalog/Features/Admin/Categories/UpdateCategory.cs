using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Admin.Redirects;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Admin.Categories;

internal static class UpdateCategory
{
    public static async Task<Results<Ok<AdminCategoryDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        SaveCategoryRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var category = await db.Set<Category>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null)
        {
            return CategoryEditor.CategoryNotFound();
        }

        var errors = new Dictionary<string, string[]>();
        if (category.ParentId is null && request.ParentId is not null)
        {
            errors["parentId"] = ["Розділ верхнього рівня не можна перенести: він відповідає групі Navkolo."];
        }
        else if (category.ParentId is not null && request.ParentId is null)
        {
            errors["parentId"] = ["Підрозділ має залишатися в одному з розділів."];
        }

        var before = new { category.Name, category.Slug, category.ParentId, category.IsVisible, category.NavkoloRef, category.SortOrder };
        var oldSlug = category.Slug;
        await CategoryEditor.ApplyCategoryAsync(category, request, isNew: false, db, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        if (oldSlug != category.Slug)
        {
            await RedirectWriter.AddRedirectAsync(db, $"/catalog/{oldSlug}", $"/catalog/{category.Slug}", time.GetUtcNow(), ct);
        }

        audit.Record("catalog.category_updated", "Category", category.Slug, new
        {
            before,
            after = new { category.Name, category.Slug, category.ParentId, category.IsVisible, category.NavkoloRef, category.SortOrder },
            category.FilterAttributes,
        });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Categories, StorefrontTags.Products], ct);

        var count = await db.Set<Product>().CountAsync(p => p.CategoryId == id, ct);
        return TypedResults.Ok(CategoryEditor.ToDto(category, count));
    }
}
