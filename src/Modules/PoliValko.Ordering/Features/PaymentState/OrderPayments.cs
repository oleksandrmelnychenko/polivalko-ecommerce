using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Features.Console.Orders;

namespace PoliValko.Ordering.Features.PaymentState;

internal sealed class OrderPayments(PoliValkoDbContext db) : IOrderPayments
{
    public async Task<PayableOrder?> FindPayableAsync(string number, string? token, CancellationToken ct)
    {
        // Untracked: LockPayableAsync must read the row again after taking the lock.
        var order = await db.Set<Order>().AsNoTracking().Include(o => o.Items).FirstOrDefaultAsync(o => o.Number == number, ct);
        if (order is null || !OrderTokens.Matches(token, order.AccessTokenHash))
        {
            return null;
        }

        return ToPayable(order);
    }

    public async Task<PayableOrder?> FindPayableForCustomerAsync(string number, Guid customerId, CancellationToken ct)
    {
        var order = await db.Set<Order>().AsNoTracking().Include(o => o.Items).FirstOrDefaultAsync(o => o.Number == number, ct);
        return order is null || order.CustomerId != customerId ? null : ToPayable(order);
    }

    public async Task<PayableOrder> LockPayableAsync(Guid orderId, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Блокування замовлення діє лише в транзакції.");
        }

        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM ordering.orders WHERE id = {orderId} FOR UPDATE", ct);
        var order = await db.Set<Order>().Include(o => o.Items).SingleAsync(o => o.Id == orderId, ct);
        return ToPayable(order);
    }

    private static PayableOrder ToPayable(Order order) => new(
        order.Id,
        order.Number,
        order.Total,
        order.PaymentMethod,
        OrderMapping.CanPay(order),
        order.Items.Select(i => new PayableOrderLine(i.Name, i.Sku, i.Quantity, i.UnitPrice)).ToList());

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
        // Untracked: completion reloads the order so its version check sees changes made meanwhile.
        var order = await db.Set<Order>()
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery()
            .SingleAsync(o => o.Id == orderId, ct);
        var refund = order.Refunds.Single(r => r.Id == refundId);

        var items = order.Items.ToDictionary(i => i.Id);
        var lines = refund.Lines
            .Select(l => new RefundToProcessLine(items[l.OrderItemId].Name, items[l.OrderItemId].Sku, l.Quantity, items[l.OrderItemId].UnitPrice))
            .ToList();
        return new RefundToProcess(order.Id, order.Number, refund.Id, refund.Status, refund.Amount, lines, refund.ProviderRef);
    }

    public async Task<bool> MarkRefundSubmittedAsync(Guid orderId, Guid refundId, string reference, CancellationToken ct) =>
        await db.Set<OrderRefund>()
            .Where(r => r.Id == refundId && r.OrderId == orderId && r.Status == RefundStatus.Pending && r.ProviderRef == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ProviderRef, reference), ct) == 1;

    public async Task<IReadOnlyList<SubmittedRefund>> ListSubmittedRefundsAsync(DateTimeOffset createdBefore, int take, CancellationToken ct) =>
        await db.Set<Order>()
            .AsNoTracking()
            .SelectMany(o => o.Refunds
                .Where(r => r.Method == RefundMethod.Provider && r.Status == RefundStatus.Pending && r.ProviderRef != null && r.CreatedAt < createdBefore)
                .Select(r => new { o.Id, o.Number, RefundId = r.Id, r.CreatedAt }))
            .OrderBy(r => r.CreatedAt)
            .Take(take)
            .Select(r => new SubmittedRefund(r.Id, r.Number, r.RefundId))
            .ToListAsync(ct);

    public async Task<bool> CompleteRefundAsync(Guid orderId, Guid refundId, DateTimeOffset at, CancellationToken ct)
    {
        var order = await WithRefundsAsync(orderId, ct);
        var refund = order.Refunds.Single(r => r.Id == refundId);
        if (refund.Status != RefundStatus.Pending)
        {
            return false;
        }

        order.ApplySucceededRefund(refund, at);
        return true;
    }

    public async Task<bool> FailRefundAsync(Guid orderId, Guid refundId, string error, DateTimeOffset at, CancellationToken ct)
    {
        var order = await WithRefundsAsync(orderId, ct);
        var refund = order.Refunds.Single(r => r.Id == refundId);
        if (refund.Status != RefundStatus.Pending)
        {
            return false;
        }

        refund.Status = RefundStatus.Failed;
        refund.Error = error;
        refund.CompletedAt = at;
        return true;
    }

    public async Task<decimal> SumProviderRefundsAsync(Guid orderId, CancellationToken ct) =>
        await db.Set<OrderRefund>()
            .Where(r => r.OrderId == orderId && r.Method == RefundMethod.Provider && r.Status != RefundStatus.Failed)
            .SumAsync(r => r.Amount, ct);

    public async Task<Guid?> RecordOutsideRefundAsync(Guid orderId, decimal amount, string provider, DateTimeOffset at, CancellationToken ct)
    {
        var order = await db.Set<Order>()
            .Include(o => o.Items)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery()
            .SingleAsync(o => o.Id == orderId, ct);
        var items = order.Items.ToDictionary(i => i.ProductId);
        var remaining = ConsoleOrderMapping.Refundable(order).Select(r => (Item: items[r.ProductId], r.Quantity)).ToList();
        var value = remaining.Sum(r => r.Item.UnitPrice * r.Quantity);
        if (remaining.Count == 0 || amount < value)
        {
            return null;
        }

        var refundId = Guid.CreateVersion7(at);
        var refund = new OrderRefund
        {
            Id = refundId,
            OrderId = order.Id,
            Method = RefundMethod.Provider,
            Status = RefundStatus.Pending,
            Amount = value,
            Reason = $"Кошти повернуто поза сайтом: провайдер {provider}, кабінет мерчанта або банк",
            RequestedBy = provider,
            CreatedAt = at,
            Lines = remaining.Select(r => new OrderRefundLine
            {
                Id = Guid.CreateVersion7(at),
                RefundId = refundId,
                OrderItemId = r.Item.Id,
                Quantity = r.Quantity,
                Amount = r.Item.UnitPrice * r.Quantity,
            }).ToList(),
        };
        order.Refunds.Add(refund);
        order.ApplySucceededRefund(refund, at);
        return refundId;
    }

    private Task<Order> WithRefundsAsync(Guid orderId, CancellationToken ct) =>
        db.Set<Order>().Include(o => o.Refunds).SingleAsync(o => o.Id == orderId, ct);

    private async Task<Order> TrackedAsync(Guid orderId, CancellationToken ct) =>
        (await db.Set<Order>().FindAsync([orderId], ct))!;
}
