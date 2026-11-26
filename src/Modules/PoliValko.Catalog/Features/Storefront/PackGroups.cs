using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;

namespace PoliValko.Catalog.Features.Storefront;

/// <summary>
/// Pack sizes of one product («0,5 г», «2 г», «10 г») are separate products sharing <see cref="Product.VariantGroup"/>;
/// a product with a <see cref="Product.VariantLabel"/> is one button of the switcher on the product page
/// (<see cref="GetProduct"/>). A listing shows the group as one card, the switcher does the rest.
/// </summary>
internal static class PackGroups
{
    /// <summary>
    /// Leaves one product of each pack group among <paramref name="products"/>, already filtered, so a filter or a
    /// search that matches only one pack size still finds it. The card is the one a shopper would pick: one that can
    /// be bought, then the cheapest.
    /// </summary>
    public static async Task<IQueryable<Product>> OneCardEachAsync(IQueryable<Product> products, CancellationToken ct)
    {
        var members = await products
            .Where(p => p.VariantGroup != null && p.VariantLabel != null)
            .Select(p => new
            {
                p.Id,
                Group = p.VariantGroup!,
                Buyable = (p.Stock.Quantity - p.Stock.ReservedQuantity) >= 1 && p.Price.Amount > 0,
                p.Price.Amount,
            })
            .ToListAsync(ct);

        var hidden = members
            .GroupBy(m => m.Group)
            .Where(g => g.Count() > 1)
            .SelectMany(g => g
                .OrderByDescending(m => m.Buyable)
                .ThenByDescending(m => m.Amount > 0)
                .ThenBy(m => m.Amount)
                .ThenBy(m => m.Id)
                .Skip(1)
                .Select(m => m.Id))
            .ToArray();

        return hidden.Length == 0 ? products : products.Where(p => !hidden.Contains(p.Id));
    }

    /// <summary>How many pack sizes each listed product's group has on the switcher, and its lowest price.</summary>
    public static async Task<Dictionary<Guid, (int Count, decimal? PriceFrom)>> SizesAsync(
        IQueryable<Product> visibleProducts,
        IReadOnlyCollection<Guid> ids,
        CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        var groupOf = await visibleProducts
            .Where(p => ids.Contains(p.Id) && p.VariantGroup != null && p.VariantLabel != null)
            .Select(p => new { p.Id, Group = p.VariantGroup! })
            .ToListAsync(ct);
        if (groupOf.Count == 0) return [];

        var groups = groupOf.Select(g => g.Group).Distinct().ToArray();
        var sizes = (await visibleProducts
                .Where(p => p.VariantGroup != null && p.VariantLabel != null && groups.Contains(p.VariantGroup))
                .Select(p => new { Group = p.VariantGroup!, p.Price.Amount })
                .ToListAsync(ct))
            .GroupBy(p => p.Group)
            .ToDictionary(g => g.Key, g =>
            {
                var prices = g.Select(p => p.Amount).Where(a => a > 0).ToList();
                // «від» only when the pack sizes cost differently.
                decimal? from = prices.Count > 1 && prices.Min() != prices.Max() ? prices.Min() : null;
                return (Count: g.Count(), PriceFrom: from);
            });

        return groupOf
            .Where(g => sizes[g.Group].Count > 1)
            .ToDictionary(g => g.Id, g => sizes[g.Group]);
    }
}
