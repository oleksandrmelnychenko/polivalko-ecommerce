using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Console.Features.Accounting;

// RecordedAt is when the movement was posted; an opening balance has none and always comes first.
public sealed record WarehouseMovement(Guid Id, DateOnly Day, string Kind, string? Reference, decimal Change, decimal Balance,
    DateTimeOffset? RecordedAt);
public sealed record ConnectWarehouseBulk(Guid OrgId, Guid StoreId, bool OverwriteExisting = false);

internal static class ShopStockSource
{
    internal static async Task<IResult> Movements(Guid id, Guid org, Guid store, PoliValkoDbContext db, int page = 1, CancellationToken ct = default)
    {
        if (page is < 1 or > 1000000) return Results.BadRequest();
        var rows = db.Database.SqlQuery<WarehouseMovement>($"""
            SELECT o.id,o.day,'opening' AS kind,o.reference,o.quantity AS change,o.quantity AS balance,NULL::timestamptz AS recorded_at
            FROM accounting.stock_openings o WHERE o.org_id={org} AND o.store_id={store} AND o.product_id={id}
            UNION ALL SELECT d.id,d.day,CASE WHEN m.is_reversal THEN 'storno' ELSE d.kind END AS kind,d.number,m.delta,m.resulting_quantity,m.recorded_at
            FROM accounting.stock_movements m
            JOIN accounting.documents d ON d.id=m.document_id
            WHERE d.native_org_id={org} AND m.store_id={store} AND m.product_id={id}
            UNION ALL SELECT s.order_id,(s.posted_at AT TIME ZONE 'Europe/Kyiv')::date,'order',o.number,-s.quantity,s.balance,s.posted_at
            FROM accounting.order_shipments s LEFT JOIN ordering.orders o ON o.id=s.order_id
            WHERE s.org_id={org} AND s.store_id={store} AND s.product_id={id}
            """);
        // Newest first in posting order, so each balance follows from the row below it; the opening stays at the bottom.
        return Results.Ok(new RegisterPage<WarehouseMovement>(await rows.OrderBy(r => r.RecordedAt == null)
            .ThenByDescending(r => r.RecordedAt).ThenBy(r => r.Id)
            .Skip((page - 1) * 50).Take(50).ToListAsync(ct), await rows.CountAsync(ct)));
    }

    internal static async Task<IResult> Connect(Guid id, ConnectWarehouse request, ICatalogWarehouseSource sources, CancellationToken ct)
    {
        var result = await sources.ConnectAsync(id, request, ct);
        if (result.Conflict != null) return Results.Problem(detail: result.Conflict, statusCode: StatusCodes.Status409Conflict);
        return result.ProductId.HasValue ? Results.Ok(result.ProductId.Value) : Results.NotFound();
    }

    internal static async Task<IResult> ConnectBulk(ConnectWarehouseBulk request, ICatalogWarehouseSource sources, CancellationToken ct)
    {
        if (request.OrgId == Guid.Empty || request.StoreId == Guid.Empty)
            return Results.BadRequest(new { title = "Виберіть організацію та склад." });
        var result = await sources.ConnectBulkAsync(request.OrgId, request.StoreId, request.OverwriteExisting, ct);
        return Results.Ok(result);
    }

    internal static async Task<IResult> Disconnect(Guid id, ICatalogWarehouseSource sources, CancellationToken ct)
    {
        var result = await sources.DisconnectAsync(id, ct);
        if (result.Conflict != null) return Results.Problem(detail: result.Conflict, statusCode: StatusCodes.Status409Conflict);
        return result.ProductId.HasValue ? Results.Ok(result.ProductId.Value) : Results.NotFound();
    }
}
