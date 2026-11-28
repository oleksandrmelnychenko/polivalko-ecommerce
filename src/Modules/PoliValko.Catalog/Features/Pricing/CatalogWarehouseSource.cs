using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Catalog.Features.Pricing;

internal sealed class CatalogWarehouseSource(PoliValkoDbContext db, ICatalogReservations reservations,
    IAuditLog audit, IOutbox outbox, TimeProvider time) : ICatalogWarehouseSource
{
    internal const string DefaultWarehouseKey = "catalog.default_warehouse.v1";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
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

    public async Task<DefaultWarehouseSetting?> GetDefaultWarehouseAsync(CancellationToken ct)
    {
        var raw = await db.Set<PlatformSetting>().AsNoTracking()
            .Where(s => s.Key == DefaultWarehouseKey)
            .Select(s => s.Value)
            .SingleOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        DefaultWarehousePayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<DefaultWarehousePayload>(raw, Json);
        }
        catch (JsonException)
        {
            return null;
        }

        if (payload is null || payload.OrgId == Guid.Empty || payload.StoreId == Guid.Empty) return null;

        return await db.Database.SqlQuery<DefaultWarehouseSetting>($"""
            SELECT o.id AS org_id, s.id AS store_id, o.title AS organization, s.title AS store
            FROM accounting.references o, accounting.references s
            WHERE o.id = {payload.OrgId} AND o.kind = 'organization'
              AND s.id = {payload.StoreId} AND s.kind = 'store'
            """).SingleOrDefaultAsync(ct);
    }

    public async Task<WarehouseConnection> SetDefaultWarehouseAsync(Guid? orgId, Guid? storeId, string updatedBy, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        if (!orgId.HasValue && !storeId.HasValue)
        {
            await db.Set<PlatformSetting>().Where(s => s.Key == DefaultWarehouseKey).ExecuteDeleteAsync(ct);
            audit.Record("accounting.default_shop_warehouse_cleared", "PlatformSetting", DefaultWarehouseKey);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return new(Guid.Empty, null);
        }

        if (orgId is not { } org || org == Guid.Empty || storeId is not { } store || store == Guid.Empty)
        {
            return new(null, "Виберіть організацію та склад.");
        }

        var exists = await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value"
            FROM accounting.references o, accounting.references s
            WHERE o.id = {org} AND o.kind = 'organization'
              AND s.id = {store} AND s.kind = 'store'
            """).AnyAsync(ct);
        if (!exists)
        {
            return new(null, "Вибрану організацію або склад не знайдено.");
        }

        await UpsertDefaultWarehouseAsync(org, store, updatedBy, ct);
        audit.Record("accounting.default_shop_warehouse_set", "PlatformSetting", DefaultWarehouseKey, new { orgId = org, storeId = store });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new(store, null);
    }

    public async Task<CatalogWarehouseInitResult> InitializeFromCatalogAsync(
        Guid orgId,
        Guid storeId,
        DateOnly day,
        string reference,
        bool includeZeroStock,
        bool setAsDefault,
        string updatedBy,
        CancellationToken ct)
    {
        var trimmedRef = reference.Trim();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var refsValid = await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value"
            FROM accounting.references o, accounting.references s
            WHERE o.id = {orgId} AND o.kind = 'organization'
              AND s.id = {storeId} AND s.kind = 'store'
            """).AnyAsync(ct);
        if (!refsValid)
        {
            return new CatalogWarehouseInitResult(0, 0, 0, ["Вибрану організацію або склад не знайдено."]);
        }

        var candidateIds = await db.Set<Product>().AsNoTracking()
            .Where(p => !p.IsArchived
                && p.Stock.WarehouseOrgId == null
                && p.Stock.WarehouseStoreId == null
                && (includeZeroStock || p.Stock.Quantity > 0))
            .OrderBy(p => p.Id)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var now = time.GetUtcNow();
        var initializedIds = new List<Guid>();
        var conflicts = new List<string>();
        var skipped = 0;

        if (candidateIds.Count > 0)
        {
            await reservations.LockAsync(candidateIds, ct);
            var idArray = candidateIds.ToArray();
            var existingWarehouseIds = (await db.Database.SqlQuery<Guid>($"""
                SELECT product_id AS "Value"
                FROM accounting.warehouse_stock
                WHERE org_id = {orgId} AND store_id = {storeId} AND product_id = ANY({idArray})
                ORDER BY product_id
                FOR UPDATE
                """).ToListAsync(ct)).ToHashSet();

            var stocks = await db.Set<ProductStock>()
                .Where(s => candidateIds.Contains(s.ProductId))
                .OrderBy(s => s.ProductId)
                .ToListAsync(ct);
            var skus = await db.Set<Product>().AsNoTracking()
                .Where(p => candidateIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Sku, ct);
            var unreconciled = (await db.Set<StockReservation>().AsNoTracking()
                .Where(r => candidateIds.Contains(r.ProductId) && r.Consumed && !r.Released)
                .Select(r => r.ProductId)
                .Distinct()
                .ToListAsync(ct)).ToHashSet();

            foreach (var stock in stocks)
            {
                if (stock.WarehouseOrgId.HasValue || stock.WarehouseStoreId.HasValue)
                {
                    skipped++;
                    continue;
                }

                if (!includeZeroStock && stock.Quantity <= 0)
                {
                    skipped++;
                    continue;
                }

                if (existingWarehouseIds.Contains(stock.ProductId))
                {
                    skipped++;
                    continue;
                }

                var sku = skus.GetValueOrDefault(stock.ProductId, stock.ProductId.ToString());
                if (unreconciled.Contains(stock.ProductId))
                {
                    conflicts.Add($"{sku}: є відвантаження попереднього джерела з незвіреним резервом.");
                    skipped++;
                    continue;
                }

                if (stock.Quantity < stock.ReservedQuantity || stock.Quantity < 0 || stock.Quantity > 999999999.999m)
                {
                    conflicts.Add($"{sku}: залишок ({stock.Quantity}) менший за резерв ({stock.ReservedQuantity}) або поза межами.");
                    skipped++;
                    continue;
                }

                var inserted = await db.Database.ExecuteSqlAsync($"""
                    INSERT INTO accounting.warehouse_stock(org_id, store_id, product_id, quantity)
                    VALUES ({orgId}, {storeId}, {stock.ProductId}, {stock.Quantity})
                    ON CONFLICT DO NOTHING
                    """, ct);
                if (inserted == 0)
                {
                    skipped++;
                    continue;
                }

                var openingId = Guid.CreateVersion7(now);
                await db.Database.ExecuteSqlAsync($"""
                    INSERT INTO accounting.stock_openings(id, org_id, store_id, product_id, quantity, day, reference)
                    VALUES ({openingId}, {orgId}, {storeId}, {stock.ProductId}, {stock.Quantity}, {day}, {trimmedRef})
                    """, ct);

                stock.WarehouseOrgId = orgId;
                stock.WarehouseStoreId = storeId;
                stock.UpdatedAt = now;
                initializedIds.Add(stock.ProductId);
            }

            if (initializedIds.Count > 0)
            {
                await db.Set<StockReservation>()
                    .Where(r => initializedIds.Contains(r.ProductId) && !r.Released && !r.Consumed)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.WarehouseOrgId, orgId)
                        .SetProperty(r => r.WarehouseStoreId, storeId), ct);
                outbox.Enqueue(new StockAvailabilityChanged());
            }
        }

        if (setAsDefault)
        {
            await UpsertDefaultWarehouseAsync(orgId, storeId, updatedBy, ct);
        }

        audit.Record("accounting.warehouse_initialized_from_catalog", "WarehouseStore", storeId.ToString(),
            new { orgId, storeId, day, reference = trimmedRef, includeZeroStock, setAsDefault, initialized = initializedIds.Count, skipped, conflicts = conflicts.Count });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new CatalogWarehouseInitResult(initializedIds.Count, initializedIds.Count, skipped, conflicts);
    }

    private async Task UpsertDefaultWarehouseAsync(Guid orgId, Guid storeId, string updatedBy, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(new DefaultWarehousePayload(orgId, storeId), Json);
        var now = time.GetUtcNow();
        var existing = await db.Set<PlatformSetting>().SingleOrDefaultAsync(s => s.Key == DefaultWarehouseKey, ct);
        if (existing is null)
        {
            db.Add(new PlatformSetting
            {
                Key = DefaultWarehouseKey,
                Value = json,
                UpdatedAt = now,
                UpdatedBy = updatedBy,
            });
        }
        else
        {
            existing.Value = json;
            existing.UpdatedAt = now;
            existing.UpdatedBy = updatedBy;
        }
    }

    internal static async Task<DefaultWarehousePayload?> ReadDefaultWarehouseAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var raw = await db.Set<PlatformSetting>().AsNoTracking()
            .Where(s => s.Key == DefaultWarehouseKey)
            .Select(s => s.Value)
            .SingleOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            var payload = JsonSerializer.Deserialize<DefaultWarehousePayload>(raw, Json);
            if (payload is null || payload.OrgId == Guid.Empty || payload.StoreId == Guid.Empty) return null;
            var valid = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value"
                FROM accounting.references o, accounting.references s
                WHERE o.id = {payload.OrgId} AND o.kind = 'organization'
                  AND s.id = {payload.StoreId} AND s.kind = 'store'
                """).AnyAsync(ct);
            return valid ? payload : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    internal sealed record DefaultWarehousePayload(Guid OrgId, Guid StoreId);
    private sealed record WarehouseStockRow(Guid ProductId, decimal Quantity);
}
