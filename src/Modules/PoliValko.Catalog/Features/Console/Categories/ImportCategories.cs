using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Categories;

public sealed record ImportCategoriesRequest([property: JsonRequired] IReadOnlyList<ImportCategoryItem>? Categories);

public sealed record ImportCategoryItem(
    [property: JsonRequired] string Name,
    [property: JsonRequired] string Slug,
    [property: JsonRequired] string? ParentSlug,
    [property: JsonRequired] string NavkoloRef);

public sealed record ImportCategoriesResult(int Created, int Unchanged);

internal static class ImportCategories
{
    private const int MaxCategories = 200;

    public static async Task<Results<Ok<ImportCategoriesResult>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        ImportCategoriesRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var items = request.Categories;
        if (items is null || items.Count is 0 or > MaxCategories)
        {
            return Invalid($"Передайте від 1 до {MaxCategories} розділів.");
        }

        var slugs = new HashSet<string>(StringComparer.Ordinal);
        var refs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            if (item is null || !IsText(item.Name, 200) || !IsSlug(item.Slug) ||
                !IsText(item.NavkoloRef, 100) || (item.ParentSlug is not null && !IsSlug(item.ParentSlug)))
            {
                return Invalid($"Рядок {i + 1}: перевірте назву, адресу, батьківський розділ та ідентифікатор Navkolo.");
            }

            if (item.Slug == item.ParentSlug || !slugs.Add(item.Slug) || !refs.Add(item.NavkoloRef))
            {
                return Invalid($"Рядок {i + 1}: адреса або ідентифікатор повторюється чи розділ посилається на себе.");
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // The catalog importer reads categories before deciding which rows to insert. Exclude stale reads through commit.
        await db.Database.ExecuteSqlRawAsync("LOCK TABLE catalog.categories IN ACCESS EXCLUSIVE MODE", ct);
        var existing = await db.Set<Category>().AsNoTracking().ToListAsync(ct);
        var bySlug = existing.ToDictionary(category => category.Slug, StringComparer.Ordinal);
        var parents = existing.ToDictionary(category => category.Id, category => category.ParentId);
        var refOwners = existing.Where(category => category.NavkoloRef is not null)
            .ToLookup(category => category.NavkoloRef!, StringComparer.OrdinalIgnoreCase);
        var sortOrders = existing.GroupBy(category => category.ParentId ?? Guid.Empty)
            .ToDictionary(group => group.Key, group => group.Max(category => category.SortOrder));
        var added = new List<Category>();

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            Guid? parentId = null;
            if (item.ParentSlug is { } parentSlug)
            {
                if (!bySlug.TryGetValue(parentSlug, out var parent) || !HasValidAncestry(parent.Id, parents))
                {
                    return Invalid($"Рядок {i + 1}: батьківський розділ має існувати або йти раніше в пакеті.");
                }

                parentId = parent.Id;
            }

            if (bySlug.TryGetValue(item.Slug, out var current))
            {
                var owners = refOwners[item.NavkoloRef];
                if (current.Name != item.Name || current.ParentId != parentId || current.NavkoloRef != item.NavkoloRef ||
                    owners.Count() != 1 || owners.First().Id != current.Id)
                {
                    return Conflict(i);
                }

                continue;
            }

            if (refOwners.Contains(item.NavkoloRef))
            {
                return Conflict(i);
            }

            var sortKey = parentId ?? Guid.Empty;
            var lastOrder = sortOrders.GetValueOrDefault(sortKey, -1);
            var sortOrder = lastOrder == int.MaxValue ? lastOrder : lastOrder + 1;
            sortOrders[sortKey] = sortOrder;
            var category = new Category
            {
                Id = Guid.CreateVersion7(), Name = item.Name, Slug = item.Slug, ParentId = parentId,
                NavkoloRef = item.NavkoloRef, SortOrder = sortOrder, IsVisible = false,
            };
            bySlug.Add(category.Slug, category);
            parents.Add(category.Id, category.ParentId);
            added.Add(category);
        }

        var result = new ImportCategoriesResult(added.Count, items.Count - added.Count);
        if (added.Count == 0)
        {
            return TypedResults.Ok(result);
        }

        db.AddRange(added);
        audit.Record("catalog.categories_imported", "Category", null, new
        {
            categories = added.Select(category => new { category.Id, category.Slug, category.ParentId, category.NavkoloRef }).ToArray(),
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Categories], ct);
        return TypedResults.Ok(result);
    }

    private static bool IsText(string? value, int maxLength) => !string.IsNullOrWhiteSpace(value) &&
        value.Length <= maxLength && value == value.Trim() && !value.Any(char.IsControl);

    private static bool IsSlug(string? value) => value is { Length: > 0 and <= 200 } && CatalogConsoleValidation.IsSlug(value);

    private static bool HasValidAncestry(Guid ancestor, IReadOnlyDictionary<Guid, Guid?> parents)
    {
        var seen = new HashSet<Guid>();
        for (Guid? current = ancestor; current is { } id;)
        {
            if (!seen.Add(id) || !parents.TryGetValue(id, out current))
            {
                return false;
            }
        }

        return true;
    }

    private static ValidationProblem Invalid(string message) => TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["categories"] = [message] });

    private static ProblemHttpResult Conflict(int index) => Problems.Create(StatusCodes.Status409Conflict, "catalog.category_import_conflict",
        "Адреса або ідентифікатор уже належить іншому розділу", $"Перевірте рядок {index + 1}. Пакет не імпортовано.");
}
