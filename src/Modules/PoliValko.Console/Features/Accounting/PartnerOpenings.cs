using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Accounting;

public sealed record ConfirmOpening(long Position, Guid PartnerId, Guid OrgId, string Direction, string Closing);
public sealed record CurrentPartnerBalance(Guid PartnerId, string Partner, Guid OrgId, string Organization,
    string Currency, string Receivable, string Payable);
public sealed record PartnerOpening(Guid Id, Guid ReportId, long Position, string SourceId, string Account,
    string Organization, DateOnly Day, string Direction, string Amount, string Due);
internal sealed record OpeningSource(long HeadingPosition, string SourceAccount, DateOnly Day, decimal Amount, Guid PartnerId);

internal static class PartnerOpenings
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/current-balances", Current).WithName("ConsoleCurrentPartnerBalances").Produces<RegisterPage<CurrentPartnerBalance>>();
        group.MapPost("/balance-reports/{id:guid}/openings", Confirm).WithName("ConsoleConfirmPartnerOpening")
            .RequirePermission(PermissionKeys.AccountingBalanceOpening).Produces<Guid>();
        group.MapGet("/partners/{id:guid}/openings", List).WithName("ConsolePartnerOpenings");
        group.MapGet("/openings/{id:guid}/payments", Payments).WithName("ConsoleOpeningPaymentHistory");
        group.MapPost("/openings/{id:guid}/payments", InvoiceWorkflow.PayOpening).WithName("ConsolePayOpening")
            .RequirePermission(PermissionKeys.AccountingPay).Produces<Guid>();
    }

    private static async Task<IResult> Current(PoliValkoDbContext db,string? q,Guid? org,string? direction,int page=1,CancellationToken ct=default)
    {
        if (page is <1 or >1000000 || q is {Length:>160} || direction is not (null or "receivable" or "payable"))
            return Results.BadRequest();
        var term=q?.Trim().ToLowerInvariant() ?? "";
        var rows=db.Database.SqlQuery<CurrentPartnerBalance>($"""
            SELECT d.partner_id,p.title AS partner,d.org_id,o.title AS organization,d.currency,d.receivable::text,d.payable::text
            FROM accounting.current_partner_balances d JOIN accounting.partners p ON p.id=d.partner_id
            JOIN accounting.references o ON o.id=d.org_id WHERE (d.receivable>0 OR d.payable>0)
                AND ({org}::uuid IS NULL OR d.org_id={org}::uuid)
                AND ({direction}::text IS DISTINCT FROM 'receivable' OR d.receivable>0)
                AND ({direction}::text IS DISTINCT FROM 'payable' OR d.payable>0)
                AND (strpos(lower(p.title),{term})>0 OR strpos(lower(p.source_id),{term})>0)
            """);
        var result=await rows.OrderBy(r=>r.Partner).ThenBy(r=>r.PartnerId).ThenBy(r=>r.Organization)
            .ThenBy(r=>r.OrgId).ThenBy(r=>r.Currency).Skip((page-1)*50).Take(50).ToListAsync(ct);
        return Results.Ok(new RegisterPage<CurrentPartnerBalance>(result,await rows.CountAsync(ct)));
    }

    private static Task<List<PartnerOpening>> List(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<PartnerOpening>($"""
            SELECT o.id,o.report_id,o.position,r.source_id,r.details#>>ARRAY['tables','0',(o.position-1)::text,'cells','0','value'] AS account,
                org.title AS organization,o.day,o.direction,o.amount::text,o.due::text
            FROM accounting.partner_opening_balances o JOIN accounting.balance_reports r ON r.id=o.report_id
            JOIN accounting.references org ON org.id=o.org_id WHERE o.partner_id={id}
            ORDER BY o.day,org.title,o.report_id,o.position
            """).ToListAsync(ct);

    private static Task<List<RecordedPayment>> Payments(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<RecordedPayment>($"""
            SELECT id,day,amount::text,method,account_title,reference FROM accounting.invoice_payments
            WHERE opening_id={id} ORDER BY day,created_at,id
            """).ToListAsync(ct);

    private static async Task<IResult> Confirm(Guid id, ConfirmOpening input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        if (input.Direction is not ("receivable" or "payable")) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Lock the heading link and the row link (whichever exist) so the row cannot change owner meanwhile.
        await db.Database.SqlQuery<Guid>($"""
            SELECT l.partner_id AS "Value" FROM accounting.balance_partner_links l
            JOIN accounting.settlements s USING(report_id,heading_position)
            WHERE s.report_id={id} AND s.position={input.Position} FOR UPDATE OF l
            """).ToListAsync(ct);
        await db.Database.SqlQuery<Guid>($"""
            SELECT partner_id AS "Value" FROM accounting.balance_row_links
            WHERE report_id={id} AND position={input.Position} FOR UPDATE
            """).ToListAsync(ct);
        var source = (await db.Database.SqlQuery<OpeningSource>($"""
            SELECT s.heading_position,s.source_account,s.day,abs(s.closing) AS amount,coalesce(rl.partner_id,l.partner_id) AS partner_id
            FROM accounting.settlements s
            LEFT JOIN accounting.balance_partner_links l USING(report_id,heading_position)
            LEFT JOIN accounting.balance_row_links rl ON rl.report_id=s.report_id AND rl.position=s.position
            JOIN accounting.references org ON org.id={input.OrgId} AND org.kind='organization'
            WHERE s.report_id={id} AND s.position={input.Position} AND NOT s.footer AND s.day IS NOT NULL
                AND s.closing::text={input.Closing} AND s.closing<>0 AND s.closing=s.opening+s.outgoing-s.incoming
                AND NOT EXISTS (SELECT 1 FROM unnest(s.source_amounts) v WHERE strpos(trim(v),chr(10))>0)
                AND coalesce(rl.partner_id,l.partner_id)={input.PartnerId}
            """).ToListAsync(ct)).SingleOrDefault();
        if (source == null) return Conflict("Перевірте прив’язку, організацію, валюту й арифметику вибраного рядка.");
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.opening_reports VALUES({source.SourceAccount},{id}) ON CONFLICT DO NOTHING
            """, ct);
        var selected = await db.Database.SqlQuery<Guid>($"""
            SELECT report_id AS "Value" FROM accounting.opening_reports WHERE source_account={source.SourceAccount}
            """).SingleAsync(ct);
        if (selected != id) return Conflict("Для початкових боргів цього джерела вже використано інший звіт.");
        var inserted = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.partner_openings(report_id,position,heading_position,partner_id,org_id,direction,amount,day)
            VALUES({id},{input.Position},{source.HeadingPosition},{input.PartnerId},{input.OrgId},{input.Direction},{source.Amount},{source.Day})
            ON CONFLICT(report_id,position) DO NOTHING
            """, ct);
        var opening = await db.Database.SqlQuery<Guid>($"""
            SELECT id AS "Value" FROM accounting.partner_openings WHERE report_id={id} AND position={input.Position}
                AND org_id={input.OrgId} AND direction={input.Direction} AND partner_id={input.PartnerId}
            """).SingleOrDefaultAsync(ct);
        if (opening == Guid.Empty) return Conflict("Цей рядок уже підтвердили з іншими реквізитами.");
        if (inserted > 0)
        {
            audit.Record("accounting.partner_opened","PartnerOpening",opening.ToString(),new { ReportId=id, Input=input });
            await db.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
        return Results.Ok(opening);
    }
    private static IResult Conflict(string detail) => Results.Problem(detail:detail,statusCode:409);
}
