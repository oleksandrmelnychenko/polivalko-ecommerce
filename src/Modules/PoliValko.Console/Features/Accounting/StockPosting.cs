using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Console.Features.Accounting;

// The warehouse ledger steps that invoices and stock operations share when they are posted.
internal static class StockPosting
{
    // Creates missing stock keys and locks them in a stable order across concurrent multi-product postings.
    // Returns a conflict message, or null once every key is locked.
    internal static async Task<string?> LockAsync(PoliValkoDbContext db, ICatalogReservations reservations, Guid org, Guid store,
        Guid[] ids, DateOnly day, string backdated, CancellationToken ct)
    {
        await reservations.LockAsync(ids, ct);
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.warehouse_stock(org_id,store_id,product_id,quantity)
            SELECT {org},{store},p.id,0 FROM catalog.products p WHERE p.id=ANY({ids}) ORDER BY p.id
            ON CONFLICT DO NOTHING
            """,ct);
        var locked = await db.Database.SqlQuery<Guid>($"""
            SELECT product_id AS "Value" FROM accounting.warehouse_stock WHERE org_id={org}
                AND store_id={store} AND product_id=ANY({ids}) ORDER BY product_id FOR UPDATE
            """).ToListAsync(ct);
        if (locked.Count!=ids.Length) return "Один із товарів більше не доступний у каталозі.";
        var early=await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value" FROM accounting.stock_openings WHERE org_id={org} AND store_id={store}
                AND product_id=ANY({ids}) AND day>{day}
            """).AnyAsync(ct);
        return early ? backdated : null;
    }

    // Quantities of locked stock keys; a product without a key yet counts as zero.
    internal static async Task<Dictionary<Guid,decimal>> QuantitiesAsync(PoliValkoDbContext db, Guid org, Guid store, Guid[] ids, CancellationToken ct) =>
        await db.Database.SqlQuery<WarehouseQuantity>($"""
            SELECT product_id,quantity FROM accounting.warehouse_stock
            WHERE org_id={org} AND store_id={store} AND product_id=ANY({ids})
            """).ToDictionaryAsync(q=>q.ProductId,q=>q.Quantity,ct);

    internal static string ShopConflict =>
        "Перевірте кількість: залишок магазину має покривати резерви і не перевищувати 999 999 999,999.";

    // Checks that a linked shop still covers its reservations, then moves the stock, records the movements
    // and copies the new quantity to a shop that sells from this warehouse. Returns false when the shop check fails.
    // Callers lock the keys with LockAsync first and pass only non-zero changes.
    internal static async Task<(bool Applied, int Synced)> ApplyAsync(PoliValkoDbContext db, Guid documentId, Guid org, Guid store,
        Guid[] ids, decimal[] deltas, CancellationToken ct)
    {
        if (ids.Length==0) return (true,0);
        var invalidShopQuantity=await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value" FROM catalog.product_stock s
            JOIN accounting.warehouse_stock w ON (w.org_id,w.store_id,w.product_id)=(s.warehouse_org_id,s.warehouse_store_id,s.product_id)
            JOIN unnest({ids}::uuid[],{deltas}::numeric[]) m(product_id,delta) ON m.product_id=s.product_id
            WHERE w.org_id={org} AND w.store_id={store}
                AND (w.quantity+m.delta<s.reserved_quantity OR w.quantity+m.delta>999999999.999)
            """).AnyAsync(ct);
        if (invalidShopQuantity) return (false,0);
        await db.Database.ExecuteSqlAsync($"""
            WITH changes AS (
                UPDATE accounting.warehouse_stock w SET quantity=w.quantity+m.delta
                FROM unnest({ids}::uuid[],{deltas}::numeric[]) AS m(product_id,delta)
                WHERE w.org_id={org} AND w.store_id={store} AND w.product_id=m.product_id
                RETURNING w.product_id,m.delta,w.quantity
            ) INSERT INTO accounting.stock_movements SELECT {documentId},product_id,delta,quantity FROM changes
            """,ct);
        var synced=await db.Database.ExecuteSqlAsync($"""
            UPDATE catalog.product_stock c SET quantity=w.quantity,updated_at=now()
            FROM accounting.warehouse_stock w WHERE (w.org_id,w.store_id,w.product_id)=(c.warehouse_org_id,c.warehouse_store_id,c.product_id)
                AND w.org_id={org} AND w.store_id={store} AND w.product_id=ANY({ids})
            """,ct);
        return (true,synced);
    }
}

internal sealed record WarehouseQuantity(Guid ProductId, decimal Quantity);
