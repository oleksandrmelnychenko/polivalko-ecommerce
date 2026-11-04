using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Console.Categories;

internal static class CategoryEditor
{
    public static async Task ApplyCategoryAsync(
        Category category,
        SaveCategoryRequest request,
        bool isNew,
        PoliValkoDbContext db,
        Dictionary<string, string[]> errors,
        CancellationToken ct)
    {
        var isSubcategory = isNew || category.ParentId is not null;
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 200)
        {
            errors["name"] = ["Вкажіть назву до 200 символів."];
        }

        var slug = string.IsNullOrWhiteSpace(request.Slug) ? Transliteration.ToSlug(name ?? string.Empty) : request.Slug.Trim().ToLowerInvariant();
        if (!CatalogConsoleValidation.IsSlug(slug) || slug.Length > 200)
        {
            errors["slug"] = ["Адреса: латинські літери, цифри й дефіси, до 200 символів."];
        }
        else if (await db.Set<Category>().AnyAsync(c => c.Slug == slug && c.Id != category.Id, ct))
        {
            errors["slug"] = ["Така адреса вже зайнята іншим розділом."];
        }

        if (isSubcategory && request.ParentId is { } parentId)
        {
            var parent = await db.Set<Category>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == parentId, ct);
            if (parent is null)
            {
                errors["parentId"] = ["Батьківський розділ не знайдено."];
            }
            else if (parent.Id == category.Id || await IsDescendantAsync(db, parent.Id, category.Id, ct))
            {
                errors["parentId"] = ["Розділ не можна вкласти сам у себе."];
            }
        }

        CatalogConsoleValidation.CheckLength(errors, "navkoloRef", request.NavkoloRef, 100);
        CatalogConsoleValidation.CheckLength(errors, "seoTitle", request.SeoTitle, 200);
        CatalogConsoleValidation.CheckLength(errors, "seoDescription", request.SeoDescription, 500);
        var filters = (request.FilterAttributes ?? [])
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Select(f => f.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (filters.Count > 10 || filters.Any(f => f.Length > 100))
        {
            errors["filterAttributes"] = ["До 10 характеристик, кожна до 100 символів."];
        }

        if (errors.Count > 0)
        {
            return;
        }

        category.Name = name!;
        category.Slug = slug;
        if (isSubcategory)
        {
            category.ParentId = request.ParentId;
        }

        category.SortOrder = request.SortOrder;
        category.IsVisible = request.IsVisible;
        category.NavkoloRef = CatalogConsoleValidation.NullIfEmpty(request.NavkoloRef);
        category.FilterAttributes = filters;
        category.SeoTitle = CatalogConsoleValidation.NullIfEmpty(request.SeoTitle);
        category.SeoDescription = CatalogConsoleValidation.NullIfEmpty(request.SeoDescription);
    }

    public static ConsoleCategoryDto ToDto(Category c, int productCount) => new(
        c.Id, c.ParentId, c.Slug, c.Name, c.SortOrder, c.IsVisible, c.NavkoloRef, c.FilterAttributes ?? [], c.SeoTitle, c.SeoDescription, productCount);

    public static ProblemHttpResult CategoryNotFound() => Problems.NotFound("catalog.category_not_found", "Розділ не знайдено");

    private static async Task<bool> IsDescendantAsync(PoliValkoDbContext db, Guid candidate, Guid ancestor, CancellationToken ct)
    {
        var parents = await db.Set<Category>().AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.ParentId, ct);
        for (var current = parents.GetValueOrDefault(candidate); current is { } id; current = parents.GetValueOrDefault(id))
        {
            if (id == ancestor)
            {
                return true;
            }
        }

        return false;
    }
}
