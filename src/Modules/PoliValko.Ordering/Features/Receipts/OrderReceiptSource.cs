using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Features.Receipts;

internal sealed class OrderReceiptSource(PoliValkoDbContext db) : IOrderReceiptSource
{
    public Task<bool> IsAccessibleAsync(string number, string? token, CancellationToken ct) =>
        OrderLoader.MatchesAccessTokenAsync(db, number, token, ct);

    public Task<bool> BelongsToCustomerAsync(string number, Guid customerId, CancellationToken ct) =>
        db.Set<Order>().AsNoTracking().AnyAsync(o => o.Number == number && o.CustomerId == customerId, ct);

    public async Task<OrderForReceipt> GetAsync(Guid orderId, CancellationToken ct)
    {
        var order = await db.Set<Order>()
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery()
            .SingleAsync(o => o.Id == orderId, ct);

        return new OrderForReceipt(
            order.Id,
            order.Number,
            order.PaymentMethod,
            order.Items.Select(i => new OrderForReceiptItem(i.Id, i.Sku, i.Name, i.UnitPrice, i.Quantity)).ToList(),
            order.Refunds
                .Select(r => new OrderForReceiptRefund(r.Id, r.Lines.Select(l => new OrderForReceiptRefundLine(l.OrderItemId, l.Quantity)).ToList()))
                .ToList(),
            order.Status);
    }
}
