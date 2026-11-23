using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Console.Customers;
using PoliValko.Ordering.Features.Console.Orders;

namespace PoliValko.Ordering.Features.Reporting;

internal sealed class OrderReporting(PoliValkoDbContext db) : IOrderReporting
{
    public async Task<IReadOnlyList<OrderPeriodRow>> ListForPeriodAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct) =>
        await db.Set<Order>().AsNoTracking()
            .Where(o => o.CreatedAt >= from && o.CreatedAt < to)
            .Select(o => new OrderPeriodRow(o.CreatedAt, o.Status, o.DeliveryMethod, o.CustomerPhone, o.Total, o.RefundedAmount))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ProductSalesRow>> TopProductsAsync(DateTimeOffset from, DateTimeOffset to, int take, CancellationToken ct)
    {
        var orders = db.Set<Order>().AsNoTracking()
            .Where(o => o.CreatedAt >= from && o.CreatedAt < to && o.Status != OrderStatus.Cancelled);
        var sold = await orders
            .SelectMany(o => o.Items)
            .GroupBy(i => i.ProductId)
            .Select(g => new { ProductId = g.Key, Quantity = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.LineTotal) })
            .ToListAsync(ct);

        // The revenue of the period is net of refunds, so the ranking is too. A refund recorded without
        // product lines cannot be assigned to a product and stays out of the ranking.
        var refunded = await orders
            .SelectMany(o => o.Refunds)
            .Where(r => r.Status == RefundStatus.Succeeded)
            .SelectMany(r => r.Lines)
            .Join(db.Set<OrderItem>().AsNoTracking(), l => l.OrderItemId, i => i.Id, (l, i) => new { i.ProductId, l.Quantity, l.Amount })
            .GroupBy(l => l.ProductId)
            .Select(g => new { ProductId = g.Key, Quantity = g.Sum(l => l.Quantity), Amount = g.Sum(l => l.Amount) })
            .ToDictionaryAsync(g => g.ProductId, ct);

        return sold
            .Select(s => refunded.TryGetValue(s.ProductId, out var back)
                ? new ProductSalesRow(s.ProductId, s.Quantity - back.Quantity, s.Revenue - back.Amount)
                : new ProductSalesRow(s.ProductId, s.Quantity, s.Revenue))
            .Where(row => row.Quantity > 0 || row.Revenue > 0)
            .OrderByDescending(row => row.Revenue)
            .ThenByDescending(row => row.Quantity)
            .ThenBy(row => row.ProductId)
            .Take(take)
            .ToList();
    }

    public async Task<IReadOnlyList<OrderedProductSnapshot>> OrderedProductSnapshotsAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct) =>
        await db.Set<OrderItem>().AsNoTracking()
            .Where(i => productIds.Contains(i.ProductId))
            .Select(i => new OrderedProductSnapshot(i.ProductId, i.Name, i.Sku, i.ImageUrl))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<OrderSearchHit>> SearchOrdersAsync(string term, int limit, CancellationToken ct)
    {
        var orders = await db.Set<Order>().AsNoTracking()
            .MatchingNumberOrPhone(term)
            .OrderByDescending(o => o.CreatedAt)
            .Take(limit)
            .Select(o => new { o.Number, o.CustomerName, o.CustomerPhone, o.Status, o.Total, o.CreatedAt })
            .ToListAsync(ct);
        return orders.Select(o => new OrderSearchHit(o.Number, o.CustomerName, o.CustomerPhone, o.Status, o.Total, o.CreatedAt)).ToList();
    }

    public async Task<IReadOnlyList<CustomerSearchHit>> SearchCustomersAsync(string term, int limit, CancellationToken ct)
    {
        var customers = await db.Set<Order>().AsNoTracking()
            .OfCustomersMatching(term)
            .GroupBy(o => o.CustomerPhone)
            .Select(g => new { Phone = g.Key, Orders = g.Count(), LastOrderAt = g.Max(o => o.CreatedAt) })
            .OrderByDescending(c => c.LastOrderAt)
            .ThenBy(c => c.Phone)
            .Take(limit)
            .ToListAsync(ct);
        var contacts = await CustomerContacts.LoadContactsAsync(db, customers.Select(c => c.Phone).ToList(), ct);
        return customers.Select(c => new CustomerSearchHit(c.Phone, contacts[c.Phone].Name, c.Orders)).ToList();
    }

    public async Task<IReadOnlyDictionary<OrderStatus, int>> CountOpenByStatusAsync(CancellationToken ct) =>
        await db.Set<Order>()
            .Where(o => o.Status == OrderStatus.New || o.Status == OrderStatus.AwaitingPayment || o.Status == OrderStatus.AwaitingConfirmation)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, ct);

    public Task<int> CountPendingRefundsAsync(CancellationToken ct) =>
        db.Set<OrderRefund>().CountAsync(r => r.Status == RefundStatus.Pending, ct);
}
