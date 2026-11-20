using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Console.Features.Accounting;

public sealed record NewPartner(Guid Id, string Title, string Kind);
public sealed record NewLine(Guid ProductId, decimal Quantity, decimal Price);
public sealed record NewDraft(Guid Id, Guid PartnerId, string Kind, string Number, DateOnly Day,
    string OrganizationId, string StoreId, List<NewLine>? Lines);
public sealed record DraftChange(string Revision, NewDraft Draft);
internal sealed record ProductReference(Guid Id, string Name, string Sku);
public sealed record RegisterReference(string Id, string Title);
public sealed record BalancePartnerLink(long HeadingPosition, Guid PartnerId, Guid? Previous);

internal static class AccountingEntry
{
    internal static async Task<IResult> LinkPartner(Guid id, BalancePartnerLink input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var valid = await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value" FROM accounting.settlements s JOIN accounting.partners p ON p.id={input.PartnerId}
                AND (p.source_account=s.source_account OR p.source_account='polivalko-native')
            WHERE s.report_id={id} AND NOT s.footer AND s.heading_position={input.HeadingPosition}
            """).AnyAsync(ct);
        if (!valid) return Invalid("Контрагента або рядок звіту не знайдено.");
        if (input.Previous.HasValue && input.Previous != input.PartnerId)
        {
            await db.Database.SqlQuery<Guid>($"""
                SELECT partner_id AS "Value" FROM accounting.balance_partner_links
                WHERE report_id={id} AND heading_position={input.HeadingPosition} FOR UPDATE
                """).ToListAsync(ct);
            var confirmed = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value" FROM accounting.partner_openings WHERE report_id={id} AND heading_position={input.HeadingPosition}
                """).AnyAsync(ct);
            if (confirmed) return Results.Problem(detail:"За цією прив’язкою вже підтверджено початковий борг.",statusCode:409);
        }
        int changed;
        if (input.Previous is Guid previous)
            changed = await db.Database.ExecuteSqlAsync($"""
                UPDATE accounting.balance_partner_links SET partner_id={input.PartnerId}
                WHERE report_id={id} AND heading_position={input.HeadingPosition} AND partner_id={previous}
                """, ct);
        else
            changed = await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.balance_partner_links VALUES ({id},{input.HeadingPosition},{input.PartnerId})
                ON CONFLICT DO NOTHING
                """, ct);
        if (changed == 0)
        {
            var applied = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value" FROM accounting.balance_partner_links WHERE report_id={id}
                    AND heading_position={input.HeadingPosition} AND partner_id={input.PartnerId}
                """).AnyAsync(ct);
            return applied ? Results.Ok(input.PartnerId) : Results.Conflict();
        }
        audit.Record("accounting.balance_partner_linked", "BalanceReport", id.ToString(), input);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(input.PartnerId);
    }
    internal static async Task<IResult> CreatePartner(NewPartner input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        if (input.Id == Guid.Empty || string.IsNullOrWhiteSpace(input.Title) || input.Title.Length > 300 ||
            input.Kind is not ("juridical" or "individual")) return Invalid("Перевірте назву та вид контрагента.");
        var title = input.Title.Trim();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var inserted = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.partners(id,source_account,source_id,title,kind,details)
            VALUES ({input.Id},'polivalko-native',{input.Id.ToString()},{title},{input.Kind},jsonb_build_object('origin','console'))
            ON CONFLICT (id) DO NOTHING
            """, ct);
        if (inserted == 0)
        {
            var matches = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value" FROM accounting.partners WHERE id={input.Id} AND source_account='polivalko-native'
                AND title={title} AND kind={input.Kind}
                """).AnyAsync(ct);
            return matches ? Results.Ok(input.Id) : Results.Conflict();
        }
        audit.Record("accounting.partner_created", "AccountingPartner", input.Id.ToString());
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(input.Id);
    }

    internal static IQueryable<RegisterReference> Organizations(PoliValkoDbContext db) =>
        db.Database.SqlQuery<RegisterReference>($"""
            SELECT id::text,title FROM accounting.references WHERE kind='organization'
            """);

    internal static IQueryable<RegisterReference> Stores(PoliValkoDbContext db) =>
        db.Database.SqlQuery<RegisterReference>($"""
            SELECT id::text,title FROM accounting.references WHERE kind='store'
            """);

    internal static Task<IResult> CreateDraft(NewDraft input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct) =>
        SaveDraft(input,null,db,audit,ct);

    internal static Task<IResult> UpdateDraft(Guid id, DraftChange change, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct) =>
        change.Draft==null || id!=change.Draft.Id || string.IsNullOrWhiteSpace(change.Revision)
            ? Task.FromResult(Invalid("Невідома версія чернетки."))
            : SaveDraft(change.Draft,change.Revision,db,audit,ct);

    private static async Task<IResult> SaveDraft(NewDraft input,string? revision,PoliValkoDbContext db,IAuditLog audit,CancellationToken ct)
    {
        if (input.Id == Guid.Empty || input.Kind is not ("in" or "out") || string.IsNullOrWhiteSpace(input.Number) ||
            input.Number.Length > 80 || input.Day == default || input.Lines is not { Count: > 0 and <= 250 } lines ||
            lines.Any(l => l == null || l.Quantity is <= 0 or > 1000000 || decimal.Round(l.Quantity,3) != l.Quantity ||
                l.Price is < 0 or > 100000000 || decimal.Round(l.Price,2) != l.Price))
            return Invalid("Вкажіть номер, дату та від 1 до 250 позицій. Кількість — до тисячних, ціна — до копійки.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var partner = await db.Database.SqlQuery<PartnerRow>($"""
            SELECT id,title,kind,source_account,source_id,NULL::text AS category FROM accounting.partners WHERE id={input.PartnerId}
            """).SingleOrDefaultAsync(ct);
        var org = await Organizations(db).SingleOrDefaultAsync(x => x.Id == input.OrganizationId, ct);
        var store = await Stores(db).SingleOrDefaultAsync(x => x.Id == input.StoreId, ct);
        if (partner == null || org == null || store == null) return Invalid("Контрагента, організацію або склад не знайдено.");
        var ids = lines.Select(l => l.ProductId).Distinct().ToArray();
        var products = await db.Database.SqlQuery<ProductReference>($"""
            SELECT id,name,sku FROM catalog.products WHERE id=ANY({ids})
            """).ToDictionaryAsync(p => p.Id, ct);
        if (products.Count != ids.Length) return Invalid("Один із товарів відсутній у каталозі.");
        var positions = lines.Select(l => new
        {
            product = new { id = l.ProductId, title = products[l.ProductId].Name, sku = products[l.ProductId].Sku },
            store = new { external_id = store.Id, title = store.Title },
            quantity = l.Quantity, price = l.Price, total = decimal.Round(l.Quantity*l.Price, 2, MidpointRounding.AwayFromZero)
        }).ToList();
        var total = positions.Sum(p => p.total);
        var request = JsonSerializer.Serialize(input);
        var details = JsonSerializer.Serialize(new { origin = "console", request = input, products = positions });
        if (revision!=null)
        {
            var updated=await db.Database.ExecuteSqlAsync($"""
                UPDATE accounting.documents SET number={input.Number.Trim()},day={input.Day},organization_id={org.Id},
                    organization={org.Title},store_ids=ARRAY[{store.Id}],partner_ref={partner.SourceId},partner_title={partner.Title},
                    total={total},details={details}::jsonb,native_partner_id={partner.Id},native_org_id={Guid.Parse(org.Id)},native_store_id={Guid.Parse(store.Id)}
                WHERE id={input.Id} AND native_partner_id IS NOT NULL AND status='draft' AND kind={input.Kind}
                    AND md5((details->'request')::text)={revision}
                """,ct);
            if (updated==0) return Results.Problem(detail:"Чернетку вже змінили або провели. Оновіть картку.",statusCode:409);
            await db.Database.ExecuteSqlAsync($"DELETE FROM accounting.product_document_lines WHERE document_id={input.Id}",ct);
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.product_document_lines(document_id,position,source_account,product_ref)
                SELECT {input.Id},n::int,'polivalko-native',p->'product'->>'id'
                FROM jsonb_array_elements({details}::jsonb->'products') WITH ORDINALITY AS t(p,n)
                """,ct);
            audit.Record("accounting.draft_updated","AccountingDocument",input.Id.ToString(),new { input.Kind,input.PartnerId,total });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Results.Ok(input.Id);
        }
        var inserted = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.documents(id,source_account,source_id,entity_type,kind,number,day,status,organization_id,
                organization,store_ids,partner_ref,partner_title,currency,total,details,native_partner_id,native_org_id,native_store_id)
            VALUES({input.Id},'polivalko-native',{input.Id.ToString()},'invoice',{input.Kind},{input.Number.Trim()},{input.Day},
                'draft',{org.Id},{org.Title},ARRAY[{store.Id}],{partner.SourceId},{partner.Title},'UAH',{total},{details}::jsonb,
                {partner.Id},{Guid.Parse(org.Id)},{Guid.Parse(store.Id)})
            ON CONFLICT (id) DO NOTHING
            """,ct);
        if (inserted == 0)
        {
            var matches = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value" FROM accounting.documents WHERE id={input.Id} AND details->'request'={request}::jsonb
                """).AnyAsync(ct);
            return matches ? Results.Ok(input.Id) : Results.Conflict();
        }
        audit.Record("accounting.draft_created","AccountingDocument",input.Id.ToString(),new { input.Kind, input.PartnerId, total });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(input.Id);
    }

    private static IResult Invalid(string message) => Results.ValidationProblem(new Dictionary<string,string[]> { ["register"] = [message] });
}
