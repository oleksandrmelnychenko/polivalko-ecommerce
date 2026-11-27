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
        outbox.Enqueue(new StockAvailabilityChanged { OrdersOnly = true });
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
        if (rows.Count > 0) outbox.Enqueue(new StockAvailabilityChanged { OrdersOnly = true });
    }

    public Task ReconcileFulfilledAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken ct) =>
        FulfillAsync(orderIds,true,ct);

    public Task ConsumeAsync(Guid orderId, CancellationToken ct) => FulfillAsync([orderId],false,ct);

    public async Task ApplyRefundAsync(Guid orderId, IReadOnlyDictionary<Guid, int> quantities, bool returnToStock, CancellationToken ct)
    {
        var requestedIds = quantities.Where(q => q.Value > 0).Select(q => q.Key).ToArray();
        if (requestedIds.Length == 0) return;

        var candidateIds = await db.Set<StockReservation>().AsNoTracking()
            .Where(r => r.OrderId == orderId && requestedIds.Contains(r.ProductId) && r.Quantity > 0)
            .Select(r => r.ProductId)
            .Distinct()
            .ToArrayAsync(ct);
        if (candidateIds.Length == 0) return;

        await LockAsync(candidateIds, ct);
        var rows = await db.Set<StockReservation>().AsNoTracking()
            .Where(r => r.OrderId == orderId && candidateIds.Contains(r.ProductId) && r.Quantity > 0)
            .OrderBy(r => r.ProductId)
            .ToListAsync(ct);

        var availabilityChanged = false;
        foreach (var row in rows)
        {
            if (!quantities.TryGetValue(row.ProductId, out var requested) || requested <= 0) continue;
            var delta = Math.Min(requested, row.Quantity);
            var remaining = row.Quantity - delta;

            if (!row.Consumed && !row.Released)
            {
                await db.Set<ProductStock>().Where(s => s.ProductId == row.ProductId)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReservedQuantity, p => p.ReservedQuantity >= delta ? p.ReservedQuantity - delta : 0m), ct);
                await db.Set<StockReservation>().Where(r => r.OrderId == row.OrderId && r.ProductId == row.ProductId)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.Quantity, remaining)
                        .SetProperty(r => r.Released, remaining == 0), ct);
                availabilityChanged = true;
            }
            else if (row.Consumed)
            {
                await db.Set<StockReservation>().Where(r => r.OrderId == row.OrderId && r.ProductId == row.ProductId)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.Quantity, remaining), ct);
                if (returnToStock)
                {
                    await RestoreStockAsync(row, delta, ct);
                    availabilityChanged = true;
                }
            }
        }

        if (availabilityChanged) outbox.Enqueue(new StockAvailabilityChanged { OrdersOnly = true });
    }

    public async Task RestockAsync(Guid orderId, CancellationToken ct)
    {
        var candidateIds = await db.Set<StockReservation>().AsNoTracking()
            .Where(r => r.OrderId == orderId && r.Consumed && r.Quantity > 0)
            .Select(r => r.ProductId)
            .Distinct()
            .ToArrayAsync(ct);
        if (candidateIds.Length == 0) return;

        await LockAsync(candidateIds, ct);
        var rows = await db.Set<StockReservation>().AsNoTracking()
            .Where(r => r.OrderId == orderId && r.Consumed && r.Quantity > 0)
            .OrderBy(r => r.ProductId)
            .ToListAsync(ct);
        if (rows.Count == 0) return;

        foreach (var row in rows)
        {
            await RestoreStockAsync(row, row.Quantity, ct);
            await db.Set<StockReservation>().Where(r => r.OrderId == row.OrderId && r.ProductId == row.ProductId)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Quantity, 0), ct);
        }

        outbox.Enqueue(new StockAvailabilityChanged { OrdersOnly = true });
    }

    private async Task RestoreStockAsync(StockReservation row, int delta, CancellationToken ct)
    {
        if (row.WarehouseOrgId.HasValue && row.WarehouseStoreId.HasValue)
        {
            var restored = await db.Database.ExecuteSqlAsync($"""
                UPDATE accounting.warehouse_stock
                SET quantity = quantity + {delta}
                WHERE org_id = {row.WarehouseOrgId} AND store_id = {row.WarehouseStoreId} AND product_id = {row.ProductId}
                """, ct);
            if (restored == 1)
            {
                await db.Database.ExecuteSqlAsync($"""
                    UPDATE catalog.product_stock s SET quantity = w.quantity, updated_at = now()
                    FROM accounting.warehouse_stock w
                    WHERE (s.product_id, s.warehouse_org_id, s.warehouse_store_id) = (w.product_id, w.org_id, w.store_id)
                        AND w.product_id = {row.ProductId} AND w.org_id = {row.WarehouseOrgId} AND w.store_id = {row.WarehouseStoreId}
                    """, ct);
            }
            return;
        }

        var current = await db.Set<ProductStock>().AsNoTracking()
            .Where(s => s.ProductId == row.ProductId)
            .Select(s => new { s.WarehouseOrgId, s.WarehouseStoreId })
            .SingleOrDefaultAsync(ct);
        if (current is { WarehouseOrgId: not null, WarehouseStoreId: not null })
        {
            var restored = await db.Database.ExecuteSqlAsync($"""
                UPDATE accounting.warehouse_stock
                SET quantity = quantity + {delta}
                WHERE org_id = {current.WarehouseOrgId} AND store_id = {current.WarehouseStoreId} AND product_id = {row.ProductId}
                """, ct);
            if (restored == 1)
            {
                await db.Database.ExecuteSqlAsync($"""
                    UPDATE catalog.product_stock s SET quantity = w.quantity, updated_at = now()
                    FROM accounting.warehouse_stock w
                    WHERE (s.product_id, s.warehouse_org_id, s.warehouse_store_id) = (w.product_id, w.org_id, w.store_id)
                        AND w.product_id = {row.ProductId} AND w.org_id = {current.WarehouseOrgId} AND w.store_id = {current.WarehouseStoreId}
                    """, ct);
            }
            return;
        }

        await db.Set<ProductStock>().Where(s => s.ProductId == row.ProductId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Quantity, p => p.Quantity + delta)
                .SetProperty(p => p.UpdatedAt, time.GetUtcNow()), ct);
    }

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
            if (managed && !row.Consumed && row.Quantity > 0)
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
                if (shipped!=1) throw new StockShortageException("Для відвантаження замовлення бракує вільного залишку на його складі.");
                await db.Database.ExecuteSqlAsync($"""
                    UPDATE catalog.product_stock s SET quantity=w.quantity,updated_at=now() FROM accounting.warehouse_stock w
                    WHERE (s.product_id,s.warehouse_org_id,s.warehouse_store_id)=(w.product_id,w.org_id,w.store_id)
                        AND w.product_id={row.ProductId} AND w.org_id={row.WarehouseOrgId} AND w.store_id={row.WarehouseStoreId}
                    """,ct);
            }
            // The shop keeps its own stock: goods that leave it are written off here and their reserve ends with them.
            // A shipment the ERP reports (reconciled) only frees the reserve: its stock sync brings the new quantity.
            var writeOff=!managed && !reconciled && !row.Consumed && !row.Released && row.Quantity > 0;
            if (writeOff)
                await db.Set<ProductStock>().Where(s => s.ProductId == row.ProductId)
                    // A count in the shop may have lowered the stock below the reserve: it never goes under zero.
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Quantity, p => p.Quantity >= row.Quantity ? p.Quantity - row.Quantity : 0m)
                        .SetProperty(p => p.ReservedQuantity, p => p.ReservedQuantity >= row.Quantity ? p.ReservedQuantity - row.Quantity : 0m)
                        .SetProperty(p => p.UpdatedAt, time.GetUtcNow()), ct);
            else if (!row.Released && row.Quantity > 0)
                await db.Set<ProductStock>().Where(s => s.ProductId == row.ProductId)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReservedQuantity, p => p.ReservedQuantity >= row.Quantity ? p.ReservedQuantity - row.Quantity : 0m), ct);
            await db.Set<StockReservation>().Where(r=>r.OrderId==row.OrderId && r.ProductId==row.ProductId)
                .ExecuteUpdateAsync(s=>s.SetProperty(r=>r.Consumed,true).SetProperty(r=>r.Released,true),ct);
            availabilityChanged=true;
        }
        if (availabilityChanged) outbox.Enqueue(new StockAvailabilityChanged { OrdersOnly = true });
    }
}
