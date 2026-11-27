using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Console.Features.Accounting;

// The warehouse ledger steps that invoices, stock operations, transfers, and reversals share.
internal static class StockPosting
{
    // Creates missing stock keys and locks them in a stable order across concurrent multi-product postings.
    // Returns a conflict message, or null once every key is locked.
    internal static Task<string?> LockAsync(PoliValkoDbContext db, ICatalogReservations reservations, Guid org, Guid store,
        Guid[] ids, DateOnly day, string backdated, CancellationToken ct) =>
        LockStoresAsync(db, reservations, org, [store], ids, day, backdated, ct);

    // Locks catalog.product_stock and accounting.warehouse_stock rows across one or more stores
    // in deterministic (product_id, store_id) order to prevent deadlocks on transfers and reversals.
    internal static async Task<string?> LockStoresAsync(PoliValkoDbContext db, ICatalogReservations reservations, Guid org,
        Guid[] stores, Guid[] ids, DateOnly? day, string backdated, CancellationToken ct)
    {
        var orderedIds = ids.Distinct().OrderBy(x => x).ToArray();
        var orderedStores = stores.Distinct().OrderBy(x => x).ToArray();
        if (orderedIds.Length == 0 || orderedStores.Length == 0) return null;
        await reservations.LockAsync(orderedIds, ct);
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.warehouse_stock(org_id,store_id,product_id,quantity)
            SELECT {org},s.store_id,p.id,0
            FROM catalog.products p CROSS JOIN unnest({orderedStores}::uuid[]) AS s(store_id)
            WHERE p.id=ANY({orderedIds})
            ORDER BY p.id,s.store_id
            ON CONFLICT DO NOTHING
            """, ct);
        var locked = await db.Database.SqlQuery<Guid>($"""
            SELECT product_id AS "Value" FROM accounting.warehouse_stock
            WHERE org_id={org} AND store_id=ANY({orderedStores}) AND product_id=ANY({orderedIds})
            ORDER BY product_id,store_id FOR UPDATE
            """).ToListAsync(ct);
        if (locked.Count != orderedIds.Length * orderedStores.Length)
            return "Один із товарів більше не доступний у каталозі.";
        if (day is DateOnly checkDay)
        {
            var early = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value" FROM accounting.stock_openings
                WHERE org_id={org} AND store_id=ANY({orderedStores}) AND product_id=ANY({orderedIds}) AND day>{checkDay}
                """).AnyAsync(ct);
            if (early) return backdated;
        }
        return null;
    }

    // Quantities of stock keys; a product without a key yet is omitted from the dictionary.
    internal static async Task<Dictionary<Guid, decimal>> QuantitiesAsync(PoliValkoDbContext db, Guid org, Guid store, Guid[] ids, CancellationToken ct) =>
        ids.Length == 0
            ? []
            : await db.Database.SqlQuery<WarehouseQuantity>($"""
                SELECT product_id,quantity FROM accounting.warehouse_stock
                WHERE org_id={org} AND store_id={store} AND product_id=ANY({ids})
                """).ToDictionaryAsync(q => q.ProductId, q => q.Quantity, ct);

    // Reserved quantities in catalog.product_stock for products currently linked to (org, store).
    internal static async Task<Dictionary<Guid, decimal>> ReservedAsync(PoliValkoDbContext db, Guid org, Guid store, Guid[] ids, CancellationToken ct) =>
        ids.Length == 0
            ? []
            : await db.Database.SqlQuery<WarehouseQuantity>($"""
                SELECT product_id,reserved_quantity AS quantity FROM catalog.product_stock
                WHERE warehouse_org_id={org} AND warehouse_store_id={store} AND product_id=ANY({ids})
                """).ToDictionaryAsync(q => q.ProductId, q => q.Quantity, ct);

    internal static string ShopConflict =>
        "Перевірте кількість: залишок магазину має покривати резерви і не перевищувати 999 999 999,999.";

    internal static string NegativeStockConflict =>
        "Неможливо сторнувати: залишок на складі стане від’ємним.";

    // Checks that a linked shop still covers its reservations, then moves the stock, records the movements
    // and copies the new quantity to a shop that sells from this warehouse. Returns false when the shop check fails.
    // Callers lock the keys with LockAsync/LockStoresAsync first and pass only non-zero changes.
    internal static async Task<(bool Applied, int Synced)> ApplyAsync(PoliValkoDbContext db, Guid documentId, Guid org, Guid store,
        Guid[] ids, decimal[] deltas, CancellationToken ct, bool isReversal = false)
    {
        if (ids.Length == 0) return (true, 0);
        var invalidShopQuantity = await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value" FROM catalog.product_stock s
            JOIN accounting.warehouse_stock w ON (w.org_id,w.store_id,w.product_id)=(s.warehouse_org_id,s.warehouse_store_id,s.product_id)
            JOIN unnest({ids}::uuid[],{deltas}::numeric[]) m(product_id,delta) ON m.product_id=s.product_id
            WHERE w.org_id={org} AND w.store_id={store}
                AND (w.quantity+m.delta<s.reserved_quantity OR w.quantity+m.delta>999999999.999)
            """).AnyAsync(ct);
        if (invalidShopQuantity) return (false, 0);
        await db.Database.ExecuteSqlAsync($"""
            WITH changes AS (
                UPDATE accounting.warehouse_stock w SET quantity=w.quantity+m.delta
                FROM unnest({ids}::uuid[],{deltas}::numeric[]) AS m(product_id,delta)
                WHERE w.org_id={org} AND w.store_id={store} AND w.product_id=m.product_id
                RETURNING w.product_id,m.delta,w.quantity
            ) INSERT INTO accounting.stock_movements(document_id,store_id,product_id,delta,resulting_quantity,is_reversal)
            SELECT {documentId},{store},product_id,delta,quantity,{isReversal} FROM changes
            """, ct);
        var synced = await db.Database.ExecuteSqlAsync($"""
            UPDATE catalog.product_stock c SET quantity=w.quantity,updated_at=now()
            FROM accounting.warehouse_stock w WHERE (w.org_id,w.store_id,w.product_id)=(c.warehouse_org_id,c.warehouse_store_id,c.product_id)
                AND w.org_id={org} AND w.store_id={store} AND w.product_id=ANY({ids})
            """, ct);
        return (true, synced);
    }

    // Reads original (non-reversal) stock movements for a posted document.
    internal static Task<List<RecordedMovement>> PostedMovementsAsync(PoliValkoDbContext db, Guid documentId, CancellationToken ct) =>
        db.Database.SqlQuery<RecordedMovement>($"""
            SELECT store_id,product_id,delta FROM accounting.stock_movements
            WHERE document_id={documentId} AND NOT is_reversal
            ORDER BY product_id,store_id
            """).ToListAsync(ct);

    // Applies exact opposite deltas across all affected stores (single store or both stores for a transfer),
    // validating warehouse non-negativity and linked catalog reserved_quantity before mutating.
    // Callers must lock all (product_id, store_id) rows with LockStoresAsync first.
    internal static async Task<(string? Conflict, int Synced)> ReverseAsync(PoliValkoDbContext db, Guid documentId, Guid org,
        List<RecordedMovement> movements, CancellationToken ct)
    {
        if (movements.Count == 0) return (null, 0);
        var byStore = movements.GroupBy(m => m.StoreId).OrderBy(g => g.Key).ToList();
        foreach (var group in byStore)
        {
            var ids = group.Select(m => m.ProductId).ToArray();
            var deltas = group.Select(m => -m.Delta).ToArray();
            var negative = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value" FROM accounting.warehouse_stock w
                JOIN unnest({ids}::uuid[],{deltas}::numeric[]) m(product_id,delta) ON m.product_id=w.product_id
                WHERE w.org_id={org} AND w.store_id={group.Key} AND w.quantity+m.delta<0
                """).AnyAsync(ct);
            if (negative) return (NegativeStockConflict, 0);
        }
        var totalSynced = 0;
        foreach (var group in byStore)
        {
            var ids = group.Select(m => m.ProductId).ToArray();
            var deltas = group.Select(m => -m.Delta).ToArray();
            var (applied, synced) = await ApplyAsync(db, documentId, org, group.Key, ids, deltas, ct, isReversal: true);
            if (!applied) return (ShopConflict, 0);
            totalSynced += synced;
        }
        return (null, totalSynced);
    }
}

internal sealed record WarehouseQuantity(Guid ProductId, decimal Quantity);
internal sealed record RecordedMovement(Guid StoreId, Guid ProductId, decimal Delta);
