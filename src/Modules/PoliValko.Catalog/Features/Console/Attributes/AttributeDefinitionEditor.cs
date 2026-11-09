using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Attributes;

internal static class AttributeDefinitionEditor
{
    public const int MaxAliases = 20;

    public static async Task<Dictionary<string, string[]>> ApplyAsync(
        AttributeDefinition definition,
        SaveAttributeDefinitionRequest request,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > AttributeDefinition.MaxNameLength)
        {
            errors["name"] = [$"Вкажіть назву до {AttributeDefinition.MaxNameLength} символів."];
        }

        CatalogConsoleValidation.CheckLength(errors, "unit", request.Unit, 20);
        var kind = request.Kind ?? definition.Kind;
        var view = request.FilterView ?? (kind == AttributeKind.Number ? definition.FilterView : AttributeFilterView.Checkboxes);
        if (view == AttributeFilterView.Range && kind != AttributeKind.Number)
        {
            errors["filterView"] = ["Вигляд «Діапазон» доступний лише для числових характеристик."];
        }

        var aliases = (request.Aliases ?? [])
            .Where(a => !string.IsNullOrWhiteSpace(a))
            .Select(a => a.Trim())
            .DistinctBy(AttributeDefinition.Normalize)
            .ToList();
        if (aliases.Count > MaxAliases || aliases.Any(a => a.Length > AttributeDefinition.MaxNameLength))
        {
            errors["aliases"] = [$"До {MaxAliases} синонімів, кожен до {AttributeDefinition.MaxNameLength} символів."];
        }

        if (errors.Count == 0)
        {
            var normalized = AttributeDefinition.Normalize(name!);
            var aliasKeys = aliases.Select(AttributeDefinition.Normalize).ToHashSet(StringComparer.Ordinal);
            var others = await db.Set<AttributeDefinition>().AsNoTracking()
                .Where(d => d.Id != definition.Id)
                .Select(d => new { d.NormalizedName, d.Aliases })
                .ToListAsync(ct);
            if (others.Any(d => d.NormalizedName == normalized || d.Aliases.Any(a => AttributeDefinition.Normalize(a) == normalized)))
            {
                errors["name"] = ["Характеристика з такою назвою чи синонімом уже є в довіднику."];
            }

            if (aliasKeys.Contains(normalized))
            {
                errors["aliases"] = ["Синонім не може збігатися з назвою."];
            }
            else if (others.Any(d => aliasKeys.Contains(d.NormalizedName) || d.Aliases.Any(a => aliasKeys.Contains(AttributeDefinition.Normalize(a)))))
            {
                errors["aliases"] = ["Синонім уже використовує інша характеристика."];
            }
        }

        if (errors.Count > 0)
        {
            return errors;
        }

        definition.Rename(name!);
        definition.Unit = CatalogConsoleValidation.NullIfEmpty(request.Unit);
        definition.Kind = kind;
        definition.FilterView = view;
        definition.SortOrder = request.SortOrder;
        definition.Aliases = aliases;
        return errors;
    }

    public static async Task<AttributeDefinitionDto> ToDtoAsync(PoliValkoDbContext db, AttributeDefinition definition, CancellationToken ct) =>
        ToDto(definition, await AttributeUsage.LoadAsync(db, ct));

    public static AttributeDefinitionDto ToDto(AttributeDefinition d, AttributeUsage usage) => new(
        d.Id,
        d.Name,
        d.Unit,
        d.Kind,
        d.FilterView,
        d.SortOrder,
        d.Aliases,
        usage.Products(d.NormalizedName),
        usage.Categories(d.NormalizedName));

    public static ProblemHttpResult NotFound() => Problems.NotFound("catalog.attribute_not_found", "Характеристику не знайдено");
}
