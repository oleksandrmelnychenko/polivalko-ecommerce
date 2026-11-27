using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Synchronization;

internal sealed class OrderStateSync(PoliValkoDbContext db, ICatalogReservations reservations,
    ICatalogPricing catalog, IAuditLog audit, TimeProvider time, ILogger<OrderStateSync> logger) : IOrderStateSync
{
    public async Task<IReadOnlyList<Guid>> TrackedIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct) =>
        await db.Set<Order>().Where(o => ids.Contains(o.Id) && (o.NavkoloExportAttemptedAt != null || o.NavkoloOrderRef != null))
            .Select(o => o.Id).ToListAsync(ct);

    public async Task LockAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Order sync requires a transaction.");
        var keys = ids.ToArray();
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM ordering.orders WHERE id = ANY({keys}) ORDER BY id FOR UPDATE", ct);
    }

    public async Task<OrderStateSyncResult> ApplyAsync(IReadOnlyList<ExternalOrderState> states, IReadOnlySet<string> stockIds, CancellationToken ct)
    {
        var tx = db.Database.CurrentTransaction ?? throw new InvalidOperationException("Order sync requires a transaction.");
        var ids = states.Select(s => s.OrderId).ToArray();
        var orders = await db.Set<Order>().Include(o => o.Items).Where(o => ids.Contains(o.Id)).ToDictionaryAsync(o => o.Id, ct);
        var products = await catalog.NavkoloIdsAsync(orders.Values.SelectMany(o => o.Items).Select(i => i.ProductId).Distinct().ToArray(), ct);
        var changed = 0;
        var errors = new List<SyncError>();
        var index = 0;
        foreach (var state in states)
        {
            if (!orders.TryGetValue(state.OrderId, out var order) || (order.NavkoloOrderRef is null && order.NavkoloExportAttemptedAt is null)) continue;
            if (order.NavkoloOrderRef is { } reference && (!Guid.TryParse(reference, out var remoteId) || remoteId != order.Id)) continue;
            if (state.Shipped && order.Items.Any(i => !products.TryGetValue(i.ProductId, out var key) || !stockIds.Contains(key)))
                throw new InvalidOperationException($"Немає свіжого залишку для відвантаження {order.Number}. Резерв збережено.");

            // Physical shipment wins over the status label, even for a locally cancelled order.
            // Isolate individual warehouse fulfillment shortages so one order cannot roll back the entire catalog sync.
            if (state.Shipped)
            {
                var savepoint = $"order_sync_{index++}";
                await tx.CreateSavepointAsync(savepoint, ct);
                try
                {
                    await reservations.ReconcileFulfilledAsync([order.Id], ct);
                    await tx.ReleaseSavepointAsync(savepoint, ct);
                }
                catch (StockShortageException ex)
                {
                    await tx.RollbackToSavepointAsync(savepoint, ct);
                    logger.LogWarning(ex, "Order {OrderNumber} fulfillment skipped during Navkolo sync due to stock shortage.", order.Number);
                    errors.Add(new SyncError(order.Number, ex.Message));
                    continue;
                }
            }

            var from = order.Status;
            if (order.ObserveNavkolo(state, time.GetUtcNow()))
            {
                changed++;
                audit.Record("order.navkolo_state_synced", "Order", order.Number, new { from, to = order.Status, state.Shipped, state.Cancelled });
            }

            if (!state.Shipped && state.Cancelled && order.NavkoloShippedAt is null && order.Status == OrderStatus.Cancelled)
                await reservations.ReleaseAsync(order.Id, ct);
        }
        return new OrderStateSyncResult(changed, errors);
    }
}
