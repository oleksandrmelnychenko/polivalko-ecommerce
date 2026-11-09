using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Catalog.Features.Pricing;

internal sealed class CatalogReservations(PoliValkoDbContext db, TimeProvider time, IOutbox outbox) : ICatalogReservations
{
    public async Task LockAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Stock reservations require a transaction.");
        // Stable ordering prevents deadlocks between overlapping, multi-product checkouts.
        var ids = productIds.Distinct().ToArray();
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM catalog.product_stock WHERE product_id = ANY({ids}) ORDER BY product_id FOR UPDATE", ct);
    }

    public async Task ReserveAsync(Guid orderId, IReadOnlyDictionary<Guid, int> quantities, CancellationToken ct)
    {
        foreach (var (id, quantity) in quantities.OrderBy(q => q.Key))
        {
            var changed = await db.Set<ProductStock>().Where(s => s.ProductId == id && s.Quantity - s.ReservedQuantity >= quantity)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReservedQuantity, p => p.ReservedQuantity + quantity), ct);
            if (changed != 1) throw new InvalidOperationException("Availability must be validated under the stock lock.");
            db.Add(new StockReservation { OrderId = orderId, ProductId = id, Quantity = quantity, CreatedAt = time.GetUtcNow() });
        }
        outbox.Enqueue(new StockAvailabilityChanged());
    }

    public async Task ReleaseAsync(Guid orderId, CancellationToken ct)
    {
        var rows = await db.Set<StockReservation>().Where(r => r.OrderId == orderId && !r.Released && !r.Consumed).ToListAsync(ct);
        await LockAsync(rows.Select(r => r.ProductId).ToArray(), ct);
        foreach (var row in rows)
        {
            await db.Entry(row).ReloadAsync(ct);
            if (row.Released || row.Consumed) continue;
            await db.Set<ProductStock>().Where(s => s.ProductId == row.ProductId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReservedQuantity, p => p.ReservedQuantity - row.Quantity), ct);
            row.Released = true;
        }
        if (rows.Count > 0) outbox.Enqueue(new StockAvailabilityChanged());
    }

    public async Task ReconcileFulfilledAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken ct)
    {
        var rows = await db.Set<StockReservation>().Where(r => orderIds.Contains(r.OrderId) && (!r.Released || !r.Consumed)).ToListAsync(ct);
        await LockAsync(rows.Select(r => r.ProductId).ToArray(), ct);
        // Re-read after acquiring locks: cancellation or another sync may have released a row meanwhile.
        foreach (var row in rows)
        {
            await db.Entry(row).ReloadAsync(ct);
            if (!row.Released)
                await db.Set<ProductStock>().Where(s => s.ProductId == row.ProductId)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReservedQuantity, p => p.ReservedQuantity - row.Quantity), ct);
            row.Consumed = true;
            row.Released = true;
        }
        if (rows.Count > 0) outbox.Enqueue(new StockAvailabilityChanged());
    }

    public Task ConsumeAsync(Guid orderId, CancellationToken ct) => db.Set<StockReservation>()
        .Where(r => r.OrderId == orderId && !r.Released)
        .ExecuteUpdateAsync(s => s.SetProperty(r => r.Consumed, true), ct);
}
