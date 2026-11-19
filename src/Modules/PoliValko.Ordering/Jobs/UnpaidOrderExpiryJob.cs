using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Configuration;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Cancellation;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Jobs;

internal sealed class UnpaidOrderExpiryJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<UnpaidOrderExpiryJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    private const int BatchSize = 100;

    protected override string Job => OrderingJobs.ExpireUnpaid;

    protected override TimeSpan Interval(IServiceProvider services) => TimeSpan.FromMinutes(15);

    protected override bool IsEnabled(IServiceProvider services)
    {
        var options = services.GetRequiredService<IOptions<OrderingOptions>>().Value;
        return options.UnpaidCardOrderHours > 0 || options.UnconfirmedOrderHours > 0;
    }

    protected override Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct) => ExpireAsync(services, ct);

    internal static async Task<SyncResult> ExpireAsync(IServiceProvider services, CancellationToken ct)
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var outbox = services.GetRequiredService<IOutbox>();
        var reservations = services.GetRequiredService<ICatalogReservations>();
        var payments = services.GetRequiredService<IPaymentActivity>();
        var options = services.GetRequiredService<IOptions<OrderingOptions>>().Value;
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        var unpaidThreshold = Threshold(now, options.UnpaidCardOrderHours);
        var unconfirmedThreshold = Threshold(now, options.UnconfirmedOrderHours);
        var orders = db.Set<Order>().AsNoTracking();

        var unconfirmed = await orders
            .Where(o => (o.Status == OrderStatus.New || o.Status == OrderStatus.AwaitingConfirmation)
                        && o.CreatedAt < unconfirmedThreshold)
            .OrderBy(o => o.CreatedAt)
            .ThenBy(o => o.Id)
            .Select(o => o.Number)
            .Take(BatchSize)
            .ToListAsync(ct);

        var unpaid = await orders
            .Where(o => o.Status == OrderStatus.AwaitingPayment
                        && o.PaymentMethod == PaymentMethod.Card
                        && (o.PaymentStatus == PaymentStatus.Pending || o.PaymentStatus == PaymentStatus.Failed)
                        && o.History.Where(h => h.To == OrderStatus.AwaitingPayment && h.From != OrderStatus.AwaitingPayment).Max(h => (DateTimeOffset?)h.At) < unpaidThreshold)
            .OrderBy(o => o.CreatedAt)
            .ThenBy(o => o.Id)
            .Select(o => new { o.Id, o.Number })
            .Take(BatchSize)
            .ToListAsync(ct);
        var busy = await payments.BusySinceAsync(unpaid.Select(c => c.Id).ToArray(), unpaidThreshold, ct);
        var numbers = unconfirmed.Concat(unpaid.Where(c => !busy.Contains(c.Id)).Select(c => c.Number));

        var errors = new List<SyncError>();
        var cancelled = 0;
        foreach (var number in numbers)
        {
            try
            {
                await using var transaction = await db.Database.BeginTransactionAsync(ct);
                await db.Database.ExecuteSqlAsync($"SELECT 1 FROM ordering.orders WHERE number = {number} FOR UPDATE", ct);
                var order = await OrderLoader.LoadAsync(db, number, tracking: true, ct);
                if (order is null || !OrderTransitions.CanCancel(order))
                {
                    continue;
                }

                string? reason = null;
                if ((order.Status is OrderStatus.New or OrderStatus.AwaitingConfirmation) && order.CreatedAt < unconfirmedThreshold)
                {
                    reason = $"Не підтверджено за {options.UnconfirmedOrderHours} год.";
                }
                else if (order is { Status: OrderStatus.AwaitingPayment, PaymentMethod: PaymentMethod.Card, PaymentStatus: PaymentStatus.Pending or PaymentStatus.Failed }
                         && order.History.Where(h => h.To == OrderStatus.AwaitingPayment && h.From != OrderStatus.AwaitingPayment).Max(h => (DateTimeOffset?)h.At) < unpaidThreshold
                         && !(await payments.BusySinceAsync([order.Id], unpaidThreshold, ct)).Contains(order.Id))
                {
                    reason = $"Не оплачено за {options.UnpaidCardOrderHours} год.";
                }

                if (reason is not null)
                {
                    order.ChangeStatus(OrderStatus.Cancelled, now, OrderActors.Schedule, reason);
                    await OrderCancellationEffects.ApplyAsync(order, outbox, reservations, ct);
                    await db.SaveChangesAsync(ct);
                    await transaction.CommitAsync(ct);
                    cancelled++;
                }
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                errors.Add(new SyncError(number, ex.Message));
            }
            finally
            {
                db.ChangeTracker.Clear();
            }
        }

        return new SyncResult($"Прострочених непідтверджених замовлень: {unconfirmed.Count}, карткових без активної оплати: {unpaid.Count - busy.Count}, скасовано: {cancelled}", errors);
    }

    private static DateTimeOffset Threshold(DateTimeOffset now, int hours) =>
        hours > 0 && hours < (now - DateTimeOffset.MinValue).TotalHours ? now.AddHours(-hours) : DateTimeOffset.MinValue;
}
