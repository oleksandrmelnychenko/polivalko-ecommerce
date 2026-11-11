using System.Globalization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Attributes;

public sealed record AttributeValueUsageDto(string Value, int ProductCount);

public sealed record AttributeFilterCategoryDto(Guid Id, string Name, string Slug, string? ParentName, bool IsVisible);

public sealed record AttributeDetailsDto(
    Guid Id,
    int ValueCount,
    IReadOnlyList<AttributeValueUsageDto> Values,
    IReadOnlyList<AttributeFilterCategoryDto> Categories);

internal static class GetAttributeDetails
{
    public const int MaxValues = 200;

    private static readonly StringComparer UkOrder = StringComparer.Create(CultureInfo.GetCultureInfo("uk-UA"), ignoreCase: true);

    public static async Task<Results<Ok<AttributeDetailsDto>, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var definition = await db.Set<AttributeDefinition>().AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct);
        if (definition is null)
        {
            return AttributeDefinitionEditor.NotFound();
        }

        var key = definition.NormalizedName;
        var names = (await db.Set<ProductAttribute>().AsNoTracking().Select(a => a.Name).Distinct().ToListAsync(ct))
            .Where(n => AttributeDefinition.Normalize(n) == key)
            .ToList();
        List<AttributeValueUsageDto> values = names.Count == 0
            ? []
            : (await db.Set<ProductAttribute>().AsNoTracking()
                    .Where(a => names.Contains(a.Name))
                    .GroupBy(a => a.Value.Trim())
                    .Select(g => new { Value = g.Key, Count = g.Select(a => a.ProductId).Distinct().Count() })
                    .ToListAsync(ct))
                .Where(v => v.Value.Length > 0)
                .OrderByDescending(v => v.Count)
                .ThenBy(v => v.Value, UkOrder)
                .Select(v => new AttributeValueUsageDto(v.Value, v.Count))
                .ToList();

        var categories = await db.Set<Category>().AsNoTracking()
            .Select(c => new { c.Id, c.Name, c.Slug, c.ParentId, c.IsVisible, c.FilterAttributes })
            .ToListAsync(ct);
        var namesById = categories.ToDictionary(c => c.Id, c => c.Name);
        var filters = categories
            .Where(c => c.FilterAttributes is not null && c.FilterAttributes.Any(f => AttributeDefinition.Normalize(f) == key))
            .Select(c => new AttributeFilterCategoryDto(
                c.Id,
                c.Name,
                c.Slug,
                c.ParentId is { } parent ? namesById.GetValueOrDefault(parent) : null,
                c.IsVisible))
            .OrderBy(c => c.ParentName ?? string.Empty, UkOrder)
            .ThenBy(c => c.Name, UkOrder)
            .ToList();

        return TypedResults.Ok(new AttributeDetailsDto(definition.Id, values.Count, values.Take(MaxValues).ToList(), filters));
    }
}
