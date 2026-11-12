using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Reporting;

internal sealed class ProductSalesSource(PoliValkoDbContext db) : IProductSalesSource
{
    public async Task<IReadOnlyList<ProductSalesCount>> TopSinceAsync(DateTimeOffset from, int take, CancellationToken ct)
    {
        var top = await db.Set<Order>().AsNoTracking()
            .Where(o => o.CreatedAt >= from && o.Status != OrderStatus.Cancelled)
            .SelectMany(o => o.Items)
            .GroupBy(i => i.ProductId)
            .Select(g => new { ProductId = g.Key, Orders = g.Select(i => i.OrderId).Distinct().Count(), Quantity = g.Sum(i => i.Quantity) })
            .OrderByDescending(x => x.Orders)
            .ThenByDescending(x => x.Quantity)
            .ThenBy(x => x.ProductId)
            .Take(take)
            .ToListAsync(ct);
        return top.Select(t => new ProductSalesCount(t.ProductId, t.Orders, t.Quantity)).ToList();
    }
}
