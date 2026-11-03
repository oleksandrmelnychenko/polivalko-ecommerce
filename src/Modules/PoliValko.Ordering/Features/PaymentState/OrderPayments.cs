using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.Ordering.Features.PaymentState;

internal sealed class OrderPayments(PoliValkoDbContext db) : IOrderPayments
{
    public async Task<PayableOrder?> FindPayableAsync(string number, string? token, CancellationToken ct)
    {
        var order = await db.Set<Order>().Include(o => o.Items).FirstOrDefaultAsync(o => o.Number == number, ct);
        if (order is null || !OrderTokens.Matches(token, order.AccessTokenHash))
        {
            return null;
        }

        return new PayableOrder(
            order.Id,
            order.Number,
            order.Total,
            order.PaymentMethod,
            OrderMapping.CanPay(order),
            order.Items.Select(i => new PayableOrderLine(i.Name, i.Sku, i.Quantity, i.UnitPrice)).ToList());
    }

    public async Task MarkPaymentRetryAsync(Guid orderId, CancellationToken ct) =>
        (await TrackedAsync(orderId, ct)).MarkPaymentRetry();

    public async Task<OrderPaymentTarget> LoadForPaymentUpdateAsync(Guid orderId, CancellationToken ct)
    {
        var order = await db.Set<Order>().FirstAsync(o => o.Id == orderId, ct);
        return new OrderPaymentTarget(order.Id, order.Number);
    }

    public async Task<PaidOrderResult> MarkPaidAsync(Guid orderId, DateTimeOffset at, CancellationToken ct)
    {
        var order = await TrackedAsync(orderId, ct);
        var changed = order.MarkPaid(at, OrderActors.Payment);
        return new PaidOrderResult(changed, order.Status == OrderStatus.Cancelled);
    }

    public async Task MarkPaymentFailedAsync(Guid orderId, CancellationToken ct) =>
        (await TrackedAsync(orderId, ct)).MarkPaymentFailed();

    public async Task<RefundToProcess> LoadRefundAsync(Guid orderId, Guid refundId, CancellationToken ct)
    {
        var order = await db.Set<Order>()
            .Include(o => o.Items)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery()
            .SingleAsync(o => o.Id == orderId, ct);
        var refund = order.Refunds.Single(r => r.Id == refundId);

        var items = order.Items.ToDictionary(i => i.Id);
        var lines = refund.Lines
            .Select(l => new RefundToProcessLine(items[l.OrderItemId].Name, items[l.OrderItemId].Sku, l.Quantity, items[l.OrderItemId].UnitPrice))
            .ToList();
        return new RefundToProcess(order.Id, order.Number, refund.Id, refund.Status, refund.Amount, lines);
    }

    public async Task CompleteRefundAsync(Guid orderId, Guid refundId, string? providerRef, DateTimeOffset at, CancellationToken ct)
    {
        var order = await TrackedAsync(orderId, ct);
        var refund = order.Refunds.Single(r => r.Id == refundId);
        refund.ProviderRef = providerRef;
        order.ApplySucceededRefund(refund, at);
    }

    public async Task FailRefundAsync(Guid orderId, Guid refundId, string error, DateTimeOffset at, CancellationToken ct)
    {
        var order = await TrackedAsync(orderId, ct);
        var refund = order.Refunds.Single(r => r.Id == refundId);
        refund.Status = RefundStatus.Failed;
        refund.Error = error;
        refund.CompletedAt = at;
    }

    private async Task<Order> TrackedAsync(Guid orderId, CancellationToken ct) =>
        (await db.Set<Order>().FindAsync([orderId], ct))!;
}
