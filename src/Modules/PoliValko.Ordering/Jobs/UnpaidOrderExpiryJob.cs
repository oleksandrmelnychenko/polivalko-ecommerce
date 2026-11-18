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

    protected override bool IsEnabled(IServiceProvider services) =>
        services.GetRequiredService<IOptions<OrderingOptions>>().Value.UnpaidCardOrderHours > 0;

    protected override async Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct)
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var outbox = services.GetRequiredService<IOutbox>();
        var reservations = services.GetRequiredService<ICatalogReservations>();
        var payments = services.GetRequiredService<IPaymentActivity>();
        var hours = services.GetRequiredService<IOptions<OrderingOptions>>().Value.UnpaidCardOrderHours;
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        var threshold = now - TimeSpan.FromHours(hours);

        var candidates = await db.Set<Order>()
            .AsNoTracking()
            .Where(o => o.Status == OrderStatus.AwaitingPayment
                        && o.PaymentMethod == PaymentMethod.Card
                        && o.History.Where(h => h.To == OrderStatus.AwaitingPayment && h.From != OrderStatus.AwaitingPayment).Max(h => h.At) < threshold)
            .OrderBy(o => o.CreatedAt)
            .Select(o => new { o.Id, o.Number })
            .Take(BatchSize)
            .ToListAsync(ct);
        var busy = await payments.BusySinceAsync(candidates.Select(c => c.Id).ToArray(), threshold, ct);
        var numbers = candidates.Where(c => !busy.Contains(c.Id)).Select(c => c.Number).ToList();

        var errors = new List<SyncError>();
        var cancelled = 0;
        foreach (var number in numbers)
        {
            try
            {
                await using var transaction = await db.Database.BeginTransactionAsync(ct);
                await db.Database.ExecuteSqlAsync($"SELECT 1 FROM ordering.orders WHERE number = {number} FOR UPDATE", ct);
                var order = await OrderLoader.LoadAsync(db, number, tracking: true, ct);
                if (order is { Status: OrderStatus.AwaitingPayment, PaymentStatus: PaymentStatus.Pending or PaymentStatus.Failed }
                    && order.History.Where(h => h.To == OrderStatus.AwaitingPayment && h.From != OrderStatus.AwaitingPayment).Max(h => h.At) < threshold
                    && !(await payments.BusySinceAsync([order.Id], threshold, ct)).Contains(order.Id))
                {
                    order.ChangeStatus(OrderStatus.Cancelled, now, OrderActors.Schedule, $"Не оплачено за {hours} год.");
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

            db.ChangeTracker.Clear();
        }

        return new SyncResult($"Неоплачених карткових замовлень, старших за {hours} год: {candidates.Count}, без активної оплати: {numbers.Count}, скасовано: {cancelled}", errors);
    }
}
