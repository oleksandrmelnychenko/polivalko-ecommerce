using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal static class ProductFacetBuilder
{
    public static async Task<ProductFacets> BuildFacetsAsync(IQueryable<Product> scope, IReadOnlyList<string> filterNames, CancellationToken ct)
    {
        var attributeRows = filterNames.Count == 0
            ? []
            : await scope
                .SelectMany(p => p.Attributes)
                .Where(a => filterNames.Contains(a.Name))
                .GroupBy(a => new { a.Name, a.Value })
                .Select(g => new AttributeRow(g.Key.Name, g.Key.Value, g.Count()))
                .ToListAsync(ct);
        var attributes = filterNames
            .Select(name => new AttributeFacet(
                name,
                attributeRows.Where(r => r.Name == name)
                    .OrderBy(r => r.Value, CategoryQueries.NaturalOrder)
                    .Select(r => new AttributeValueFacet(r.Value, r.Count))
                    .ToList()))
            .Where(f => f.Values.Count > 0)
            .ToList();

        var brands = await scope
            .Where(p => p.Brand != null)
            .GroupBy(p => p.Brand!)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .OrderByDescending(b => b.Count)
            .ThenBy(b => b.Name)
            .ToListAsync(ct);

        var prices = await scope
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Min = g.Min(p => p.Price.Amount),
                Max = g.Max(p => p.Price.Amount),
                InStock = g.Count(p => p.Stock.Quantity > 0),
            })
            .FirstOrDefaultAsync(ct);

        return new ProductFacets(
            brands.Select(b => new BrandFacet(b.Name, b.Count)).ToList(),
            prices is null ? null : MoneyDto.Hryvnia(prices.Min),
            prices is null ? null : MoneyDto.Hryvnia(prices.Max),
            prices?.InStock ?? 0,
            attributes);
    }

    public static Dictionary<string, List<string>>? ParseAttributeFilters(string[]? filters)
    {
        var result = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var filter in filters ?? [])
        {
            var separator = filter.IndexOf(':', StringComparison.Ordinal);
            if (separator <= 0 || separator == filter.Length - 1)
            {
                return null;
            }

            var name = filter[..separator].Trim();
            if (!result.TryGetValue(name, out var values))
            {
                result[name] = values = [];
            }

            values.Add(filter[(separator + 1)..].Trim());
        }

        return result;
    }

    public static IReadOnlyList<string> FilterAttributesOf(Category category, IReadOnlyDictionary<Guid, Category> byId)
    {
        for (var current = category; current is not null; current = current.ParentId is { } parent ? byId.GetValueOrDefault(parent) : null)
        {
            if (current.FilterAttributes is { Count: > 0 })
            {
                return current.FilterAttributes;
            }
        }

        return [];
    }

    private sealed record AttributeRow(string Name, string Value, int Count);
}
