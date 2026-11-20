using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Accounting;

public sealed record RegisterPage<T>(List<T> Items, int Total);
public sealed record PartnerRow(Guid Id, string Title, string? Kind, string SourceAccount, string SourceId, string? Category);
public sealed record DocumentRow(Guid Id, string EntityType, string? Kind, string? Number, DateOnly? Day, string? Status,
    string SourceAccount, string SourceId, string? Organization, string? OrganizationId,
    string? PartnerTitle, string? PartnerRef, Guid? PartnerId, string? Agreement,
    string? Currency, string? Amount, string? ParentRef, string? ParentKind, string? Paid, string? Due, string? PaymentStatus);
public sealed record LineRow(long Position, string? ProductRef, string? Product, string? Sku, string? StoreRef,
    string? Store, string? Quantity, string? Price, string? Total, Guid? CatalogId);
public sealed record DocumentCard(DocumentRow Document, List<LineRow> Lines, List<DocumentRow> Parents, List<DocumentRow> Related);
public sealed record BalanceReport(Guid Id, string SourceAccount, string SourceId, DateOnly? Day, string? CapturedAt, Guid? OpeningReportId);
public sealed record BalanceRow(long Position, bool Footer, string? PartnerTitle, string? Account, string? Opening,
    string? Incoming, string? Outgoing, string? Closing, string? Difference, string?[] SourceAmounts,
    long? HeadingPosition, Guid? LinkedPartner, Guid? Candidate, int CandidateCount, Guid? OpeningId, bool HeadingConfirmed);
public sealed record AgreementRow(string? Id, string? Title, string? Currency);
public sealed record PartnerCard(PartnerRow Partner, List<AgreementRow> Agreements);
public sealed record ProductMovement(Guid DocumentId, int Position, DateOnly? Day, string? Number, string? EntityType,
    string? Kind,string? Status,string? Title,string? Sku,string? Store,string? Quantity,string? Price,string? Total,string? Currency);

public static class AccountingRegisters
{
    public static void MapAccountingRegisters(this RouteGroupBuilder console)
    {
        var group = console.MapGroup("/accounting").WithTags("Accounting").RequireStaff(PermissionKeys.AccountingView);
        group.AddEndpointFilter((context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return next(context);
        });
        group.MapGet("/partners", Partners).WithName("ConsoleAccountingPartners").Produces<RegisterPage<PartnerRow>>();
        group.MapGet("/partners/{id:guid}", PartnerDetail).WithName("ConsoleAccountingPartner").Produces<PartnerCard>();
        group.MapGet("/references", async (PoliValkoDbContext db, CancellationToken ct) => new {
            Organizations = await AccountingEntry.Organizations(db).OrderBy(x => x.Title).ToListAsync(ct),
            Stores = await AccountingEntry.Stores(db).OrderBy(x => x.Title).ToListAsync(ct)
        }).WithName("ConsoleAccountingReferences");
        group.MapGet("/documents", Documents).WithName("ConsoleAccountingDocuments").Produces<RegisterPage<DocumentRow>>();
        group.MapGet("/documents/{id:guid}", Card).WithName("ConsoleAccountingDocument").Produces<DocumentCard>();
        group.MapGet("/product-history", ProductHistory).WithName("ConsoleAccountingProductHistory").Produces<RegisterPage<ProductMovement>>();
        group.MapGet("/balance-reports", Reports).WithName("ConsoleAccountingBalanceReports");
        group.MapGet("/balance-reports/{id:guid}", Balances).WithName("ConsoleAccountingBalances").Produces<List<BalanceRow>>();
        group.MapPut("/balance-reports/{id:guid}/partner", AccountingEntry.LinkPartner)
            .WithName("ConsoleLinkBalancePartner").RequirePermission(PermissionKeys.AccountingEdit);
        group.MapPost("/partners", AccountingEntry.CreatePartner).WithName("ConsoleCreateAccountingPartner").RequirePermission(PermissionKeys.AccountingEdit);
        group.MapPost("/drafts", AccountingEntry.CreateDraft).WithName("ConsoleCreateInvoiceDraft").RequirePermission(PermissionKeys.AccountingEdit);
        group.MapPut("/drafts/{id:guid}", AccountingEntry.UpdateDraft).WithName("ConsoleUpdateInvoiceDraft").RequirePermission(PermissionKeys.AccountingEdit);
        InvoiceWorkflow.Map(group);
        InventoryReview.Map(group);
        PartnerOpenings.Map(group);
    }

    private static IQueryable<DocumentRow> AllDocuments(PoliValkoDbContext db) =>
        db.Database.SqlQuery<DocumentRow>($"""
            SELECT d.*,CASE WHEN i.status='posted' THEN i.paid::text END AS paid,i.due::text AS due,
                CASE WHEN i.due=0 THEN 'settled' WHEN i.paid>0 THEN 'partial' WHEN i.due>0 THEN 'unpaid' END AS payment_status
            FROM accounting.document_register d LEFT JOIN accounting.invoice_operations i ON i.id=d.id
            """);

    private static IQueryable<PartnerRow> AllPartners(PoliValkoDbContext db) =>
        db.Database.SqlQuery<PartnerRow>($"""
            SELECT id,title,kind,source_account,source_id,details->'category'->>'title' AS category FROM accounting.partners
            """);

    private static async Task<IResult> PartnerDetail(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var partner = await AllPartners(db).SingleOrDefaultAsync(p => p.Id == id, ct);
        if (partner == null) return Results.NotFound();
        var agreements = await db.Database.SqlQuery<AgreementRow>($"""
            SELECT a->>'external_id' AS id,a->>'title' AS title,a->>'currency_iso' AS currency
            FROM accounting.partners p CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(p.details->'agreements')='array' THEN p.details->'agreements' ELSE '[]' END) a
            WHERE p.id={id}
            """).ToListAsync(ct);
        return Results.Ok(new PartnerCard(partner, agreements));
    }

    private static bool InvalidPage(int page, string? q) => page is < 1 or > 1_000_000 || q is { Length: > 160 };

    private static async Task<IResult> ProductHistory(string account,string productRef,PoliValkoDbContext db,
        int page=1,CancellationToken ct=default)
    {
        if (InvalidPage(page,null) || account.Length > 64 || productRef.Length > 200) return Invalid();
        var rows = db.Database.SqlQuery<ProductMovement>($"""
            SELECT d.id AS document_id,l.position,d.day,d.number,d.entity_type,d.kind,d.status,
                item->'product'->>'title' AS title,item->'product'->>'sku' AS sku,item->'store'->>'title' AS store,
                item->>'quantity' AS quantity,item->>'price' AS price,item->>'total' AS total,d.currency
            FROM accounting.product_document_lines l JOIN accounting.documents d ON d.id=l.document_id
            CROSS JOIN LATERAL (SELECT d.details->'products'->(l.position-1) AS item) v
            WHERE l.source_account={account} AND l.product_ref=lower({productRef})
            """);
        return await Page(rows.OrderByDescending(r=>r.Day.HasValue).ThenByDescending(r=>r.Day)
            .ThenBy(r=>r.DocumentId).ThenBy(r=>r.Position),page,ct);
    }
    private static IResult Invalid() => Results.BadRequest(new { title = "Перевірте параметри фільтра." });
    private static async Task<IResult> Page<T>(IQueryable<T> rows, int page, CancellationToken ct) =>
        Results.Ok(new RegisterPage<T>(await rows.Skip((page - 1) * 50).Take(50).ToListAsync(ct), await rows.CountAsync(ct)));

    private static async Task<IResult> Partners(PoliValkoDbContext db, string? q, int page = 1, CancellationToken ct = default)
    {
        if (InvalidPage(page, q)) return Invalid();
        var rows = AllPartners(db);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = string.Join(" ",q.Split((char[]?)null,StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();
            rows = db.Database.SqlQuery<PartnerRow>($"""
                SELECT id,title,kind,source_account,source_id,details->'category'->>'title' AS category
                FROM accounting.partners WHERE strpos(regexp_replace(lower(title),'[[:space:]  ]+',' ','g'),{term})>0
                    OR strpos(lower(source_id),{term})>0
                """);
        }
        return await Page(rows.OrderBy(p => p.Title).ThenBy(p => p.Id), page, ct);
    }

    private static async Task<IResult> Documents(PoliValkoDbContext db, string? register, Guid? partnerId,
        string? q, string? status, DateOnly? from, DateOnly? to, string? queue, int page = 1, CancellationToken ct = default)
    {
        if (InvalidPage(page, q) || from > to || register is not (null or "in" or "out")) return Invalid();
        var rows = AllDocuments(db);
        if (queue != null)
        {
            rows = rows.Where(d => d.SourceAccount=="polivalko-native" && d.EntityType=="invoice");
            rows = queue switch
            {
                "drafts" => rows.Where(d => d.Status=="draft"),
                "receivable" => rows.Where(d => d.Kind=="out" && (d.PaymentStatus=="partial" || d.PaymentStatus=="unpaid")),
                "payable" => rows.Where(d => d.Kind=="in" && (d.PaymentStatus=="partial" || d.PaymentStatus=="unpaid")),
                "settled" => rows.Where(d => d.PaymentStatus=="settled"),
                _ => null
            };
            if (rows==null) return Invalid();
        }
        if (register != null) rows = rows.Where(d => d.EntityType == "invoice" && d.Kind == register);
        if (partnerId != null) rows = rows.Where(d => d.PartnerId == partnerId);
        if (status != null) rows = rows.Where(d => d.Status == status);
        if (from != null) rows = rows.Where(d => d.Day >= from);
        if (to != null) rows = rows.Where(d => d.Day <= to);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLowerInvariant();
            rows = rows.Where(d => d.SourceId.ToLower().Contains(term) ||
                (d.Number != null && d.Number.ToLower().Contains(term)) ||
                (d.PartnerTitle != null && d.PartnerTitle.ToLower().Contains(term)) ||
                (d.Organization != null && d.Organization.ToLower().Contains(term)));
        }
        return await Page(rows.OrderByDescending(d => d.Day.HasValue).ThenByDescending(d => d.Day).ThenBy(d => d.Id), page, ct);
    }

    private static async Task<IResult> Card(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var doc = await AllDocuments(db).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (doc == null) return Results.NotFound();
        var lines = await db.Database.SqlQuery<LineRow>($"""
            SELECT position,product_ref,product,sku,store_ref,store,quantity,price,total,catalog_id
            FROM accounting.document_lines WHERE document_id={id} ORDER BY position
            """).ToListAsync(ct);
        var documents = AllDocuments(db).Where(x => x.SourceAccount == doc.SourceAccount);
        List<DocumentRow> parents = [];
        if (doc.ParentRef is { } parent && doc.ParentKind != null)
            parents = await documents.Where(x => (x.EntityType == "invoice" || x.EntityType == "receipt" || x.EntityType == "customerReturn") &&
                x.SourceId.ToLower() == parent.ToLower() && x.Kind == doc.ParentKind).OrderBy(x => x.Id).ToListAsync(ct);
        List<DocumentRow> related = [];
        if (doc.EntityType is "invoice" or "receipt" or "customerReturn")
            related = await documents.Where(x => x.ParentRef != null && x.ParentRef.ToLower() == doc.SourceId.ToLower() &&
                x.ParentKind == doc.Kind).OrderBy(x => x.Day).ThenBy(x => x.Id).ToListAsync(ct);
        return Results.Ok(new DocumentCard(doc, lines, parents, related));
    }

    private static Task<List<BalanceReport>> Reports(PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<BalanceReport>($"""
            SELECT r.id,r.source_account,r.source_id,r.day,r.captured_at,o.report_id AS opening_report_id
            FROM accounting.balance_reports r LEFT JOIN accounting.opening_reports o USING(source_account)
            ORDER BY day DESC NULLS LAST,captured_at DESC NULLS LAST,id
            """).ToListAsync(ct);

    private static async Task<IResult> Balances(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var rows = await db.Database.SqlQuery<BalanceRow>($"""
            WITH candidates AS MATERIALIZED (
                SELECT p.source_account,trim(regexp_replace(lower(p.title),'[[:space:]  ]+',' ','g')) AS name,
                    count(*)::int AS candidate_count,CASE WHEN count(*)=1 THEN (array_agg(p.id))[1] END AS candidate
                FROM accounting.partners p GROUP BY 1,2
            )
            SELECT s.position,s.footer,CASE WHEN s.footer THEN NULL ELSE s.partner_title END AS partner_title,s.account,
                opening::text,incoming::text,outgoing::text,closing::text,
                (closing-(opening+outgoing-incoming))::text AS difference,source_amounts,
                CASE WHEN s.footer THEN NULL ELSE s.heading_position END AS heading_position,
                l.partner_id AS linked_partner,c.candidate,coalesce(c.candidate_count,0) AS candidate_count,
                o.id AS opening_id,EXISTS(SELECT 1 FROM accounting.partner_openings h
                   WHERE h.report_id=s.report_id AND h.heading_position=s.heading_position) AS heading_confirmed
            FROM accounting.settlements s LEFT JOIN accounting.balance_partner_links l ON NOT s.footer
                AND l.report_id=s.report_id AND l.heading_position=s.heading_position
            LEFT JOIN candidates c ON NOT s.footer AND c.source_account=s.source_account
                AND c.name=trim(regexp_replace(lower(s.partner_title),'[[:space:]  ]+',' ','g'))
            LEFT JOIN accounting.partner_openings o ON o.report_id=s.report_id AND o.position=s.position
            WHERE s.report_id={id} ORDER BY s.position
            """).ToListAsync(ct);
        return Results.Ok(rows);
    }
}
