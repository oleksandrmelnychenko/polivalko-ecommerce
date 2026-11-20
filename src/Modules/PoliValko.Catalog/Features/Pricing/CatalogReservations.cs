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
        var ids=quantities.Keys.ToArray();
        var sources=await db.Set<ProductStock>().Where(s=>ids.Contains(s.ProductId))
            .Select(s=>new {s.ProductId,s.WarehouseOrgId,s.WarehouseStoreId}).ToDictionaryAsync(s=>s.ProductId,ct);
        foreach (var (id, quantity) in quantities.OrderBy(q => q.Key))
        {
            var changed = await db.Set<ProductStock>().Where(s => s.ProductId == id && s.Quantity - s.ReservedQuantity >= quantity)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReservedQuantity, p => p.ReservedQuantity + quantity), ct);
            if (changed != 1) throw new InvalidOperationException("Availability must be validated under the stock lock.");
            var source=sources[id];
            db.Add(new StockReservation { OrderId = orderId, ProductId = id, Quantity = quantity, CreatedAt = time.GetUtcNow(),
                WarehouseOrgId=source.WarehouseOrgId, WarehouseStoreId=source.WarehouseStoreId });
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

    public Task ReconcileFulfilledAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken ct) =>
        FulfillAsync(orderIds,true,ct);

    public Task ConsumeAsync(Guid orderId, CancellationToken ct) => FulfillAsync([orderId],false,ct);

    private async Task FulfillAsync(IReadOnlyCollection<Guid> orderIds, bool reconciled, CancellationToken ct)
    {
        var pending=db.Set<StockReservation>().Where(r=>orderIds.Contains(r.OrderId) &&
            (reconciled ? (!r.Released || !r.Consumed) : (!r.Released && !r.Consumed)));
        await LockAsync(await pending.Select(r=>r.ProductId).Distinct().ToArrayAsync(ct),ct);
        var rows=await pending.AsNoTracking().OrderBy(r=>r.ProductId).ThenBy(r=>r.OrderId).ToListAsync(ct);
        var availabilityChanged=false;
        foreach (var row in rows)
        {
            var managed=row.WarehouseStoreId.HasValue;
            if (managed && !row.Consumed)
            {
                var shipped=await db.Database.ExecuteSqlAsync($"""
                    WITH movement AS (
                        UPDATE accounting.warehouse_stock w SET quantity=w.quantity-{row.Quantity}
                        FROM catalog.product_stock s WHERE w.org_id={row.WarehouseOrgId} AND w.store_id={row.WarehouseStoreId}
                        AND w.product_id={row.ProductId} AND s.product_id=w.product_id AND w.quantity-{row.Quantity} >=
                            CASE WHEN (s.warehouse_org_id,s.warehouse_store_id)=(w.org_id,w.store_id)
                                THEN s.reserved_quantity-{(row.Released?0:row.Quantity)} ELSE 0 END
                        RETURNING w.org_id,w.store_id,w.product_id,w.quantity
                    ) INSERT INTO accounting.order_shipments(order_id,product_id,org_id,store_id,quantity,balance)
                    SELECT {row.OrderId},product_id,org_id,store_id,{row.Quantity},quantity FROM movement
                    """,ct);
                if (shipped!=1) throw new InvalidOperationException("Для відвантаження замовлення бракує вільного залишку на його складі.");
                await db.Database.ExecuteSqlAsync($"""
                    UPDATE catalog.product_stock s SET quantity=w.quantity,updated_at=now() FROM accounting.warehouse_stock w
                    WHERE (s.product_id,s.warehouse_org_id,s.warehouse_store_id)=(w.product_id,w.org_id,w.store_id)
                        AND w.product_id={row.ProductId} AND w.org_id={row.WarehouseOrgId} AND w.store_id={row.WarehouseStoreId}
                    """,ct);
            }
            var release=managed || reconciled;
            if (release && !row.Released)
                await db.Set<ProductStock>().Where(s => s.ProductId == row.ProductId)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReservedQuantity, p => p.ReservedQuantity - row.Quantity), ct);
            await db.Set<StockReservation>().Where(r=>r.OrderId==row.OrderId && r.ProductId==row.ProductId)
                .ExecuteUpdateAsync(s=>s.SetProperty(r=>r.Consumed,true).SetProperty(r=>r.Released,release||row.Released),ct);
            availabilityChanged |= release;
        }
        if (availabilityChanged) outbox.Enqueue(new StockAvailabilityChanged());
    }
}
