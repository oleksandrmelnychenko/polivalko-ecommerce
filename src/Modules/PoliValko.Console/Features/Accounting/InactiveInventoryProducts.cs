using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Accounting;

public sealed record InactiveInventoryProduct(int Position, Guid EvidenceId, int EvidencePosition, string Code,
    string Title, string Unit, decimal Quantity, string? Barcode, decimal RetailPrice, decimal PurchasePrice,
    Guid? CategoryId, Guid? ProductId, string Status);
public sealed record LinkInactiveProduct(Guid EvidenceId, int EvidencePosition, string Code);

internal static class InactiveInventoryProducts
{
    internal static void Map(RouteGroupBuilder group)
    {
        var products = group.MapGroup("/inventory-reports/{id:guid}/inactive-products");
        products.MapGet("", (Guid id, PoliValkoDbContext db, CancellationToken ct) =>
            Candidates(db, id).OrderBy(p => p.Position).ToListAsync(ct)).WithName("ConsoleInactiveInventoryProducts");
        products.MapPost("/{position:int}", Create).WithName("ConsoleLinkInactiveInventoryProduct")
            .RequirePermission(PermissionKeys.CatalogImportRun).Produces<Guid>();
    }

    private static IQueryable<InactiveInventoryProduct> Candidates(PoliValkoDbContext db, Guid id) =>
        db.Database.SqlQuery<InactiveInventoryProduct>($"SELECT * FROM accounting.inactive_inventory_products({id})");

    private static async Task<IResult> Create(Guid id, int position, LinkInactiveProduct input,
        PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"""
            SELECT 1 FROM accounting.inventory_lines WHERE report_id={id} AND position={position} FOR UPDATE
            """, ct);
        // SKU is indexed but not unique. Serialize this check with catalog writers.
        await db.Database.ExecuteSqlRawAsync("LOCK TABLE catalog.products IN SHARE ROW EXCLUSIVE MODE", ct);
        var row = await Candidates(db, id).SingleOrDefaultAsync(p => p.Position == position, ct);
        if (row is null || row.EvidenceId != input.EvidenceId || row.EvidencePosition != input.EvidencePosition ||
            row.Code != input.Code) return Conflict();
        if (row.ProductId is Guid linked) return Results.Ok(linked);
        if (row.Status != "available") return Conflict();

        var productId = Guid.NewGuid();
        var added = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO catalog.products(id,navkolo_id,sku,name,slug,category_id,is_visible,created_at,updated_at)
            SELECT {productId},'dntrade-code:'||{row.Code},{row.Code},{row.Title},'dntrade-inactive-'||{row.Code},id,false,now(),now()
            FROM catalog.categories WHERE id={row.CategoryId} AND NOT is_visible ON CONFLICT DO NOTHING
            """, ct);
        if (added != 1) return Conflict();
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO catalog.product_prices(product_id,amount,updated_at) VALUES({productId},{row.RetailPrice},now());
            INSERT INTO catalog.product_stock(product_id,quantity,updated_at) VALUES({productId},0,now());
            INSERT INTO catalog.product_attributes(id,product_id,name,value,sort_order)
            SELECT gen_random_uuid(),{productId},name,value,sort_order FROM
                (VALUES ('Одиниця виміру',{row.Unit},0),('Штрихкод',{row.Barcode}::text,1)) a(name,value,sort_order)
            WHERE value IS NOT NULL;
            INSERT INTO accounting.inventory_product_links(report_id,position,evidence_id,evidence_position,product_id)
            VALUES({id},{position},{row.EvidenceId},{row.EvidencePosition},{productId});
            """, ct);
        audit.Record("accounting.inactive_product_created", "Product", productId.ToString(),
            new { ReportId = id, position, row.EvidenceId, row.EvidencePosition, row.Code });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(productId);
    }

    private static IResult Conflict() => Results.Problem(statusCode: 409,
        detail: "Перевірте код товару, вихідні звіти та наявність прихованої категорії. Оновіть перелік перед повтором.");
}
