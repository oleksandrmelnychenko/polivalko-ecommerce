using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Accounting;

public sealed record InventoryReport(Guid Id,string SourceId,string Kind,DateOnly? Day,string? StoreName,int Rows,int? FirstRow);
public sealed record InventoryRow(int Position,string? Code,string? Title,string? Unit,string? QuantityText,
    decimal? Quantity,decimal? Booked,Guid? ProductId,string? ProductName,Guid? StoreId,string Status,Guid? OpeningId,Guid? OpeningOrgId);
public sealed record InventorySelection(int Position,Guid ProductId,decimal Quantity);
public sealed record ConfirmInventory(Guid OrgId,Guid StoreId,List<InventorySelection>? Lines);
public sealed record InventoryCount(string Status,int Count);
public sealed record InventoryPage(List<InventoryRow> Items,int Total,List<InventoryCount> Counts);

internal static class InventoryReview
{
    internal static void Map(RouteGroupBuilder group)
    {
        InactiveInventoryProducts.Map(group);
        group.MapGet("/inventory-reports",Reports).WithName("ConsoleInventoryReports");
        group.MapGet("/inventory-reports/{id:guid}",Rows).WithName("ConsoleInventoryRows").Produces<InventoryPage>();
        group.MapPost("/inventory-reports/{id:guid}/confirm",Confirm).WithName("ConsoleConfirmInventory")
            .RequirePermission(PermissionKeys.AccountingOpening).Produces<int>();
    }

    private static Task<List<InventoryReport>> Reports(PoliValkoDbContext db,CancellationToken ct) =>
        db.Database.SqlQuery<InventoryReport>($"""
            SELECT r.id,r.source_id,r.kind,r.day,r.store_name,count(l.position)::int AS rows,r.first_row
            FROM accounting.inventory_reports r LEFT JOIN accounting.inventory_lines l ON l.report_id=r.id
            GROUP BY r.id ORDER BY r.day DESC NULLS LAST,CASE r.kind WHEN 'cutover' THEN 0 WHEN 'balances' THEN 1 ELSE 2 END,
                r.store_name,r.first_row NULLS LAST,r.source_id,r.id
            """).ToListAsync(ct);

    private static IQueryable<InventoryRow> Review(PoliValkoDbContext db,Guid id,Guid? org) =>
        db.Database.SqlQuery<InventoryRow>($"SELECT * FROM accounting.inventory_review({id},{org}::uuid)");

    private static async Task<IResult> Rows(Guid id,Guid? org,string? q,string? status,string? amount,PoliValkoDbContext db,int page=1,CancellationToken ct=default)
    {
        if (page is <1 or >1000000 || q is {Length:>160} || amount is not (null or "positive" or "zero" or "negative")) return Results.BadRequest();
        var rows=Review(db,id,org);
        if (amount=="positive") rows=rows.Where(r=>r.Quantity>0);
        if (amount=="zero") rows=rows.Where(r=>r.Quantity==0);
        if (amount=="negative") rows=rows.Where(r=>r.Quantity<0);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term=q.Trim().ToLowerInvariant();
            rows=rows.Where(r=>(r.Code!=null && r.Code.ToLower().Contains(term)) || (r.Title!=null && r.Title.ToLower().Contains(term)));
        }
        var counts=await rows.GroupBy(r=>r.Status).Select(g=>new InventoryCount(g.Key,g.Count())).ToListAsync(ct);
        if (status=="review") rows=rows.Where(r=>r.Status!="ready" && r.Status!="confirmed" && r.Status!="reference");
        else if (status!=null) rows=rows.Where(r=>r.Status==status);
        var items=await rows.OrderBy(r=>r.Position).Skip((page-1)*50).Take(50).ToListAsync(ct);
        var total=counts.Where(c=>status==null || c.Status==status || (status=="review" && c.Status is not ("ready" or "confirmed" or "reference"))).Sum(c=>c.Count);
        return Results.Ok(new InventoryPage(items,total,counts));
    }

    private static async Task<IResult> Confirm(Guid id,ConfirmInventory input,PoliValkoDbContext db,IAuditLog audit,CancellationToken ct)
    {
        if(input.Lines is not {Count:>0 and <=50} lines || lines.Any(l=>l==null || l.Position<1) ||
            lines.Select(l=>l.Position).Distinct().Count()!=lines.Count) return Results.BadRequest();
        var positions=lines.Select(l=>l.Position).ToArray();
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        if(!await db.Database.SqlQuery<int>($"SELECT 1 AS \"Value\" FROM accounting.references WHERE id={input.OrgId} AND kind='organization'").AnyAsync(ct))
            return Results.BadRequest();
        await db.Database.ExecuteSqlAsync($"""
            SELECT 1 FROM accounting.inventory_lines WHERE report_id={id} AND position=ANY({positions}) ORDER BY position FOR UPDATE
            """,ct);
        var current=await Review(db,id,input.OrgId).Where(r=>positions.Contains(r.Position)).ToDictionaryAsync(r=>r.Position,ct);
        if(lines.Any(l=>!current.TryGetValue(l.Position,out var row) || row.StoreId!=input.StoreId || row.Quantity!=l.Quantity ||
            row.ProductId!=l.ProductId || !(row.Status=="ready" || row.Status=="confirmed" && row.OpeningOrgId==input.OrgId))) return Conflict();
        var pending=current.Values.Where(r=>r.Status=="ready").OrderBy(r=>r.ProductId).ToList();
        var productIds=pending.Select(r=>r.ProductId!.Value).ToArray();
        var amounts=pending.Select(r=>r.Quantity!.Value).ToArray();
        var rowNumbers=pending.Select(r=>r.Position).ToArray();
        if (pending.Count>0)
        {
            var added=await db.Database.ExecuteSqlAsync($"""
                WITH selected AS (SELECT * FROM unnest({productIds}::uuid[],{amounts}::numeric[],{rowNumbers}::int[]) s(product_id,quantity,position)),
                stock AS (INSERT INTO accounting.warehouse_stock(org_id,store_id,product_id,quantity)
                    SELECT {input.OrgId},{input.StoreId},product_id,quantity FROM selected ORDER BY product_id
                    ON CONFLICT DO NOTHING RETURNING *),
                openings AS (INSERT INTO accounting.stock_openings(id,org_id,store_id,product_id,quantity,day,reference)
                    SELECT gen_random_uuid(),s.org_id,s.store_id,s.product_id,s.quantity,r.day,r.source_id||' · '||v.position
                    FROM stock s JOIN selected v USING(product_id) JOIN accounting.inventory_reports r ON r.id={id}
                    RETURNING id,store_id,product_id)
                INSERT INTO accounting.inventory_confirmations(report_id,position,opening_id,source_account,store_id,product_id)
                SELECT r.id,v.position,o.id,r.source_account,o.store_id,o.product_id FROM openings o JOIN selected v USING(product_id)
                JOIN accounting.inventory_reports r ON r.id={id} ORDER BY o.product_id ON CONFLICT DO NOTHING
                """,ct);
            if(added!=pending.Count) return Conflict();
            audit.Record("accounting.inventory_openings_confirmed","InventoryReport",id.ToString(),new {input.OrgId,input.StoreId,Positions=rowNumbers});
            await db.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
        return Results.Ok(lines.Count);
    }
    private static IResult Conflict()=>Results.Problem(detail:"Вибрані рядки змінилися або вже мають рух. Оновіть таблицю й перевірте організацію.",statusCode:409);
}
