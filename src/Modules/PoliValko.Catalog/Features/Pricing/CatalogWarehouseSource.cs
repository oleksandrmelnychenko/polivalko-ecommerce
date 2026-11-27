using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Pricing;

internal sealed class CatalogWarehouseSource(PoliValkoDbContext db, ICatalogReservations reservations,
    IAuditLog audit, IOutbox outbox, TimeProvider time) : ICatalogWarehouseSource
{
    public async Task<WarehouseConnection> ConnectAsync(Guid id, ConnectWarehouse request, CancellationToken ct)
    {
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        await reservations.LockAsync([id],ct);
        var stock=await db.Set<ProductStock>().SingleOrDefaultAsync(s=>s.ProductId==id,ct);
        if (stock==null) return new(null,null);
        if (stock.WarehouseOrgId==request.OrgId && stock.WarehouseStoreId==request.StoreId) return new(id,null);
        var quantities=await db.Database.SqlQuery<decimal>($"""
            SELECT quantity AS "Value" FROM accounting.warehouse_stock WHERE product_id={id}
                AND org_id={request.OrgId} AND store_id={request.StoreId} FOR UPDATE
            """).ToListAsync(ct);
        if (quantities.Count==0) return new(null,null);
        var quantity=quantities[0];
        if (stock.WarehouseOrgId!=request.ExpectedOrgId || stock.WarehouseStoreId!=request.ExpectedStoreId ||
            quantity!=request.WarehouseQuantity || stock.Quantity!=request.ShopQuantity || stock.ReservedQuantity!=request.Reserved)
            return new(null,"Залишок, резерв або джерело змінились. Оновіть таблицю й перевірте кількість.");
        if (quantity<stock.ReservedQuantity || quantity>999999999.999m)
            return new(null,"Залишок має покривати резерв і поміщатися у поле кількості магазину.");
        if (stock.WarehouseStoreId.HasValue && stock.ReservedQuantity>0)
            return new(null,"На поточному складі є зарезервовані замовлення. Завершіть їх перед зміною складу.");
        if (await db.Set<StockReservation>().AnyAsync(r=>r.ProductId==id && r.Consumed && !r.Released,ct))
            return new(null,"Є відвантаження попереднього джерела з незвіреним резервом.");
        audit.Record("accounting.shop_stock_source_changed","Product",id.ToString(),request);
        stock.WarehouseOrgId=request.OrgId;
        stock.WarehouseStoreId=request.StoreId;
        stock.Quantity=quantity;
        stock.UpdatedAt=time.GetUtcNow();
        await db.Set<StockReservation>().Where(r=>r.ProductId==id && !r.Released && !r.Consumed)
            .ExecuteUpdateAsync(s=>s.SetProperty(r=>r.WarehouseOrgId,request.OrgId)
                .SetProperty(r=>r.WarehouseStoreId,request.StoreId),ct);
        outbox.Enqueue(new StockAvailabilityChanged());
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new(id,null);
    }

    public async Task<BulkWarehouseConnection> ConnectBulkAsync(Guid orgId, Guid storeId, bool overwriteExisting, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var candidateIds = await db.Database.SqlQuery<Guid>($"""
            SELECT product_id AS "Value"
            FROM accounting.warehouse_stock
            WHERE org_id = {orgId} AND store_id = {storeId}
            ORDER BY product_id
            """).ToListAsync(ct);
        if (candidateIds.Count == 0)
        {
            return new BulkWarehouseConnection(0, 0, []);
        }

        await reservations.LockAsync(candidateIds, ct);
        var idArray = candidateIds.ToArray();
        var warehouseRows = await db.Database.SqlQuery<WarehouseStockRow>($"""
            SELECT product_id, quantity
            FROM accounting.warehouse_stock
            WHERE org_id = {orgId} AND store_id = {storeId} AND product_id = ANY({idArray})
            ORDER BY product_id
            FOR UPDATE
            """).ToListAsync(ct);

        var stocks = await db.Set<ProductStock>()
            .Where(s => candidateIds.Contains(s.ProductId))
            .ToDictionaryAsync(s => s.ProductId, ct);
        var skus = await db.Set<Product>().AsNoTracking()
            .Where(p => candidateIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Sku, ct);
        var unreconciled = (await db.Set<StockReservation>().AsNoTracking()
            .Where(r => candidateIds.Contains(r.ProductId) && r.Consumed && !r.Released)
            .Select(r => r.ProductId)
            .Distinct()
            .ToListAsync(ct)).ToHashSet();

        var now = time.GetUtcNow();
        var connectedIds = new List<Guid>();
        var conflicts = new List<string>();
        var skipped = 0;

        foreach (var row in warehouseRows)
        {
            if (!stocks.TryGetValue(row.ProductId, out var stock))
            {
                skipped++;
                continue;
            }

            if (stock.WarehouseOrgId == orgId && stock.WarehouseStoreId == storeId)
            {
                skipped++;
                continue;
            }

            if (stock.WarehouseStoreId.HasValue && !overwriteExisting)
            {
                skipped++;
                continue;
            }

            var sku = skus.GetValueOrDefault(row.ProductId, row.ProductId.ToString());
            if (row.Quantity < stock.ReservedQuantity || row.Quantity > 999999999.999m)
            {
                conflicts.Add($"{sku}: залишок складу ({row.Quantity}) не покриває резерв ({stock.ReservedQuantity}) або перевищує ліміт.");
                skipped++;
                continue;
            }

            if (stock.WarehouseStoreId.HasValue && stock.ReservedQuantity > 0)
            {
                conflicts.Add($"{sku}: на поточному складі є зарезервовані замовлення ({stock.ReservedQuantity}).");
                skipped++;
                continue;
            }

            if (unreconciled.Contains(row.ProductId))
            {
                conflicts.Add($"{sku}: є відвантаження попереднього джерела з незвіреним резервом.");
                skipped++;
                continue;
            }

            stock.WarehouseOrgId = orgId;
            stock.WarehouseStoreId = storeId;
            stock.Quantity = row.Quantity;
            stock.UpdatedAt = now;
            connectedIds.Add(row.ProductId);
        }

        if (connectedIds.Count > 0)
        {
            await db.Set<StockReservation>()
                .Where(r => connectedIds.Contains(r.ProductId) && !r.Released && !r.Consumed)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.WarehouseOrgId, orgId)
                    .SetProperty(r => r.WarehouseStoreId, storeId), ct);
            audit.Record("accounting.shop_stock_source_bulk_connected", "WarehouseStore", storeId.ToString(),
                new { orgId, storeId, overwriteExisting, connected = connectedIds.Count, skipped, conflicts = conflicts.Count });
            outbox.Enqueue(new StockAvailabilityChanged());
            await db.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);
        return new BulkWarehouseConnection(connectedIds.Count, skipped, conflicts);
    }

    public async Task<WarehouseConnection> DisconnectAsync(Guid productId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await reservations.LockAsync([productId], ct);
        var stock = await db.Set<ProductStock>().SingleOrDefaultAsync(s => s.ProductId == productId, ct);
        if (stock is null) return new(null, null);
        if (stock.WarehouseOrgId is null && stock.WarehouseStoreId is null) return new(productId, null);
        if (stock.ReservedQuantity > 0)
            return new(null, "На поточному складі є зарезервовані замовлення. Завершіть або скасуйте їх перед відв'язанням.");
        if (await db.Set<StockReservation>().AnyAsync(r => r.ProductId == productId && r.Consumed && !r.Released, ct))
            return new(null, "Є відвантаження попереднього джерела з незвіреним резервом.");

        var previous = new { stock.WarehouseOrgId, stock.WarehouseStoreId };
        stock.WarehouseOrgId = null;
        stock.WarehouseStoreId = null;
        stock.UpdatedAt = time.GetUtcNow();
        audit.Record("accounting.shop_stock_source_disconnected", "Product", productId.ToString(), previous);
        outbox.Enqueue(new StockAvailabilityChanged());
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new(productId, null);
    }

    private sealed record WarehouseStockRow(Guid ProductId, decimal Quantity);
}
