using System.Globalization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Storefront;

internal static class CategoryQueries
{
    public static readonly StringComparer NaturalOrder =
        StringComparer.Create(CultureInfo.GetCultureInfo("uk-UA"), CompareOptions.NumericOrdering);

    public static Task<List<Category>> LoadVisibleCategoriesAsync(PoliValkoDbContext db, CancellationToken ct) =>
        db.Set<Category>()
            .AsNoTracking()
            .Where(c => c.IsVisible)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(ct);

    public static IEnumerable<Guid> Descendants(Guid id, ILookup<Guid?, Category> byParent) =>
        byParent[id].SelectMany(child => Descendants(child.Id, byParent).Prepend(child.Id));

    public static CategoryRefDto ToRef(Category c) => new(c.Id, c.Slug, c.Name);

    public static ProblemHttpResult CategoryNotFound(string slug) =>
        Problems.NotFound("catalog.category_not_found", "Категорію не знайдено", $"Категорії '{slug}' немає або вона прихована.");

    public static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
}
