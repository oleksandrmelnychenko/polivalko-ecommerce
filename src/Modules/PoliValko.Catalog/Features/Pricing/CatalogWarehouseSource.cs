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
}
