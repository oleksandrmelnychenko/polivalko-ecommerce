using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Catalog.Features.Storefront;

internal static class GetCategory
{
    public static async Task<Results<Ok<CategoryDto>, ProblemHttpResult>> HandleAsync(
        string slug,
        PoliValkoDbContext db,
        ISettingsStore settings,
        CancellationToken ct)
    {
        var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
        var category = categories.FirstOrDefault(c => c.Slug == slug);
        if (category is null)
        {
            return CategoryQueries.CategoryNotFound(slug);
        }

        var byId = categories.ToDictionary(c => c.Id);
        var breadcrumbs = new List<CategoryRefDto>();
        for (var parentId = category.ParentId; parentId is { } id && byId.TryGetValue(id, out var parent); parentId = parent.ParentId)
        {
            breadcrumbs.Insert(0, CategoryQueries.ToRef(parent));
        }

        var children = categories.Where(c => c.ParentId == category.Id).Select(CategoryQueries.ToRef).ToList();
        var templates = await SeoTemplates.LoadAsync(settings, ct);
        var (seoTitle, seoDescription) = SeoTemplates.Fill(
            templates.Category,
            category.SeoTitle,
            category.SeoDescription,
            new SeoTemplates.Values(category.Name, null, breadcrumbs.LastOrDefault()?.Name ?? category.Name, null));
        return TypedResults.Ok(new CategoryDto(
            category.Id,
            category.Slug,
            category.Name,
            breadcrumbs,
            children,
            seoTitle,
            seoDescription,
            category.ImageUrl,
            category.Description));
    }
}
