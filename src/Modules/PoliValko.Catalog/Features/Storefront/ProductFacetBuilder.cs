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

        // One pass over the scope, grouped by brand (products without one form a group of their own), gives both the
        // brand counts and the price range: one round trip instead of two.
        var groups = await scope
            .Select(p => new { p.Brand, p.Price.Amount, InStock = (p.Stock.Quantity - p.Stock.ReservedQuantity) >= 1 && p.Price.Amount > 0 })
            .GroupBy(p => p.Brand)
            .Select(g => new
            {
                Name = g.Key,
                Count = g.Count(),
                // The range covers real prices: "price on request" (0) would pull its lower end down to nothing.
                Min = g.Where(x => x.Amount > 0).Min(x => (decimal?)x.Amount),
                Max = g.Max(x => x.Amount),
                InStock = g.Count(x => x.InStock),
            })
            // Sorted by the database, so brand names keep its collation.
            .OrderByDescending(g => g.Count)
            .ThenBy(g => g.Name)
            .ToListAsync(ct);

        var brands = groups
            .Where(g => g.Name != null)
            .Select(g => new BrandFacet(g.Name!, g.Count))
            .ToList();
        var any = groups.Count > 0;

        return new ProductFacets(
            brands,
            any ? MoneyDto.Hryvnia(groups.Min(g => g.Min) ?? 0m) : null,
            any ? MoneyDto.Hryvnia(groups.Max(g => g.Max)) : null,
            groups.Sum(g => g.InStock),
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
