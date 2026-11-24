using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Accounting;

public sealed record IssuedOffer(Guid PartnerId, DateOnly Day, string Focus, string Body, string? SelectionBasis = null);
public sealed record OfferRow(Guid Id, Guid PartnerId, string Partner, DateOnly Day, string Focus, string Body,
    int Shipments, decimal Shipped, string? InvoiceNumbers);
public sealed record OfferInvoice(Guid Id, string? Number, DateOnly Day, decimal Amount);

internal static class SalesOffers
{
    internal static void Map(RouteGroupBuilder group)
    {
        var offers = group.MapGroup("/offers");
        offers.MapGet("", List).WithName("ConsoleListSalesOffers").Produces<List<OfferRow>>();
        offers.MapPut("/{id:guid}", Issue).RequirePermission(PermissionKeys.AccountingEdit).WithName("ConsoleIssueSalesOffer");
        offers.MapGet("/{id:guid}/invoices", Invoices).WithName("ConsoleOfferInvoices");
        offers.MapPut("/{id:guid}/invoices/{documentId:guid}", Link).RequirePermission(PermissionKeys.AccountingEdit)
            .WithName("ConsoleLinkOfferInvoice");
    }

    private static async Task<IResult> List(DateOnly from, DateOnly to, PoliValkoDbContext db, CancellationToken ct)
    {
        if (to < from || to.DayNumber-from.DayNumber > 366) return Results.BadRequest();
        var rows = await db.Database.SqlQuery<OfferRow>($"""
            SELECT o.id,o.partner_id,p.title AS partner,o.day,o.focus,o.body,count(d.id)::int AS shipments,
                coalesce(sum(d.amount),0) AS shipped,string_agg(coalesce(d.number,d.id::text), ', ' ORDER BY d.day,d.id) AS invoice_numbers
            FROM accounting.sales_offers o JOIN accounting.partners p ON p.id=o.partner_id
            LEFT JOIN accounting.sales_offer_shipments s ON s.offer_id=o.id
            LEFT JOIN accounting.offer_invoices d ON d.id=s.document_id AND d.partner_id=o.partner_id AND d.day>=o.day
            WHERE o.day BETWEEN {from} AND {to}
            GROUP BY o.id,p.title ORDER BY o.day DESC,o.id
            """).ToListAsync(ct);
        return Results.Ok(rows);
    }

    private static async Task<IResult> Issue(Guid id, IssuedOffer input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        if (id == Guid.Empty || input.PartnerId == Guid.Empty || input.Day == default || input.Focus is not ("irrigation" or "general")
            || input.SelectionBasis is not (null or "statistics" or "catalog" or "manual")
            || string.IsNullOrWhiteSpace(input.Body) || input.Body.Length > 8000)
            return Results.BadRequest(new { title = "Перевірте дату, контрагента й текст пропозиції" });
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var added = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.sales_offers(id,partner_id,day,focus,body,selection_basis)
            SELECT {id},p.id,{input.Day},{input.Focus},{input.Body},{input.SelectionBasis} FROM accounting.partners p
            WHERE p.id={input.PartnerId} AND p.merged_into IS NULL AND {input.Day} <= (now() AT TIME ZONE 'Europe/Kyiv')::date
            ON CONFLICT (id) DO NOTHING
            """,ct);
        if (added == 0)
        {
            var same = await db.Database.SqlQuery<bool>($"""
                SELECT EXISTS(SELECT 1 FROM accounting.sales_offers WHERE id={id} AND partner_id={input.PartnerId}
                    AND day={input.Day} AND focus={input.Focus} AND body={input.Body}
                    AND selection_basis IS NOT DISTINCT FROM {input.SelectionBasis}) AS "Value"
                """).SingleAsync(ct);
            return same ? Results.Ok(id) : Results.Conflict(new { title = "Перевірте дату та контрагента або оновіть пропозицію" });
        }
        audit.Record("sales_offer.issued","SalesOffer",id.ToString(),new { input.PartnerId,input.Focus,input.SelectionBasis });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static Task<List<OfferInvoice>> Invoices(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<OfferInvoice>($"""
            SELECT d.id,d.number,d.day,d.amount FROM accounting.offer_invoices d
            JOIN accounting.sales_offers o ON o.id={id} AND o.partner_id=d.partner_id AND d.day>=o.day
            WHERE NOT EXISTS(SELECT 1 FROM accounting.sales_offer_shipments s WHERE s.document_id=d.id)
            ORDER BY d.day DESC,d.id
            """).ToListAsync(ct);

    private static async Task<IResult> Link(Guid id, Guid documentId, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var added = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.sales_offer_shipments(offer_id,document_id)
            SELECT o.id,d.id FROM accounting.sales_offers o JOIN accounting.offer_invoices d ON d.partner_id=o.partner_id
            WHERE o.id={id} AND d.id={documentId} AND d.day>=o.day
            ON CONFLICT(document_id) DO NOTHING
            """,ct);
        if (added == 0)
        {
            var same = await db.Database.SqlQuery<bool>($"""
                SELECT EXISTS(SELECT 1 FROM accounting.sales_offer_shipments WHERE offer_id={id} AND document_id={documentId}) AS "Value"
                """).SingleAsync(ct);
            return same ? Results.Ok(documentId) : Results.Conflict(new { title = "Накладна недоступна для цього розрахунку" });
        }
        audit.Record("sales_offer.invoice_linked","SalesOffer",id.ToString(),new { documentId });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(documentId);
    }
}
