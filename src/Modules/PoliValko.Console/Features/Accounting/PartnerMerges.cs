using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Accounting;

public sealed record PartnerMerge(List<Guid> Duplicates);
internal sealed record MergeCard(Guid Id, Guid? MergedInto, bool HasMerged);

// Duplicate cards stay in the directory as aliases of their main card, so a merge can be undone.
internal static class PartnerMerges
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/partners/{id:guid}/merge", Merge).WithName("ConsoleMergeAccountingPartners")
            .RequirePermission(PermissionKeys.AccountingEdit).Produces<int>();
        group.MapPost("/partners/{id:guid}/unmerge", Unmerge).WithName("ConsoleUnmergeAccountingPartner")
            .RequirePermission(PermissionKeys.AccountingEdit).Produces<Guid>();
    }

    private static IResult Problem(string detail, int status = 409) => Results.Problem(detail: detail, statusCode: status);

    private static Task<List<MergeCard>> Lock(PoliValkoDbContext db, Guid[] ids, CancellationToken ct) =>
        db.Database.SqlQuery<MergeCard>($"""
            SELECT id,merged_into,EXISTS(SELECT 1 FROM accounting.partners c WHERE c.merged_into=p.id) AS has_merged
            FROM accounting.partners p WHERE id=ANY({ids}) ORDER BY id FOR UPDATE
            """).ToListAsync(ct);

    private static async Task<IResult> Merge(Guid id, PartnerMerge input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        var duplicates = (input.Duplicates ?? []).Distinct().ToArray();
        if (duplicates.Length is 0 or > 20 || duplicates.Contains(id))
            return Problem("Оберіть від однієї до 20 інших карток.", 400);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var cards = await Lock(db, [id, .. duplicates], ct);
        if (cards.Count != duplicates.Length + 1) return Problem("Картку не знайдено.", 404);
        if (cards.Any(c => c.MergedInto != null)) return Problem("Одна з карток уже об’єднана з іншою.");
        if (cards.Any(c => c.Id != id && c.HasMerged))
            return Problem("До картки-дубля вже приєднано інші. Спершу скасуйте ті об’єднання або оберіть її основною.");
        Guid[] all = [id, .. duplicates];
        var clash = await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value" FROM accounting.recommendation_offers a JOIN accounting.recommendation_offers b
                ON a.product_id=b.product_id AND a.partner_id<b.partner_id
            WHERE a.partner_id=ANY({all}) AND b.partner_id=ANY({all})
                AND (a.last_purchase IS NOT DISTINCT FROM b.last_purchase
                    OR (a.status IN ('offered','reserved') AND b.status IN ('offered','reserved')))
            """).AnyAsync(ct);
        if (clash) return Problem("Обом карткам уже запропоновано той самий товар. Закрийте одну з пропозицій і повторіть.");
        foreach (var duplicate in duplicates)
        {
            await db.Database.ExecuteSqlAsync($"""
                WITH d AS (UPDATE accounting.documents SET native_partner_id={id} WHERE native_partner_id={duplicate} RETURNING id),
                hl AS (UPDATE accounting.balance_partner_links SET partner_id={id} WHERE partner_id={duplicate}
                    RETURNING report_id,heading_position),
                rl AS (UPDATE accounting.balance_row_links SET partner_id={id} WHERE partner_id={duplicate} RETURNING report_id,position),
                o AS (UPDATE accounting.partner_openings SET partner_id={id} WHERE partner_id={duplicate} RETURNING id),
                so AS (UPDATE accounting.sales_offers SET partner_id={id} WHERE partner_id={duplicate} RETURNING id),
                ro AS (UPDATE accounting.recommendation_offers SET partner_id={id} WHERE partner_id={duplicate} RETURNING id),
                p AS (UPDATE accounting.partners SET merged_into={id} WHERE id={duplicate} RETURNING id)
                INSERT INTO accounting.partner_merges(duplicate_id,main_id,moved)
                SELECT p.id,{id},jsonb_build_object(
                    'documents',(SELECT coalesce(jsonb_agg(id),'[]') FROM d),
                    'headingLinks',(SELECT coalesce(jsonb_agg(jsonb_build_array(report_id,heading_position)),'[]') FROM hl),
                    'rowLinks',(SELECT coalesce(jsonb_agg(jsonb_build_array(report_id,position)),'[]') FROM rl),
                    'openings',(SELECT coalesce(jsonb_agg(id),'[]') FROM o),
                    'salesOffers',(SELECT coalesce(jsonb_agg(id),'[]') FROM so),
                    'recommendationOffers',(SELECT coalesce(jsonb_agg(id),'[]') FROM ro))
                FROM p
                """, ct);
            audit.Record("accounting.partner_merged", "Partner", duplicate.ToString(), new { MainId = id });
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(duplicates.Length);
    }

    // Moves back only what the merge moved and what still sits on the main card. Refuses when an opening was confirmed
    // on the main card through a moved link after the merge, so an opening never ends up on a different card than its link.
    private static async Task<IResult> Unmerge(Guid id, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var main = await db.Database.SqlQuery<Guid?>($"""
            SELECT main_id AS "Value" FROM accounting.partner_merges WHERE duplicate_id={id}
            """).SingleOrDefaultAsync(ct);
        if (main is not Guid mainId) return Problem("Цю картку не об’єднано з іншою.", 404);
        await Lock(db, [id, mainId], ct);
        var confirmedSince = await db.Database.SqlQuery<int>($"""
            WITH m AS (SELECT moved FROM accounting.partner_merges WHERE duplicate_id={id}),
            logged AS (SELECT (jsonb_array_elements_text(moved->'openings'))::uuid AS id FROM m),
            heading AS (SELECT (e->>0)::uuid AS report_id,(e->>1)::bigint AS heading_position FROM m,jsonb_array_elements(m.moved->'headingLinks') e),
            row_link AS (SELECT (e->>0)::uuid AS report_id,(e->>1)::bigint AS position FROM m,jsonb_array_elements(m.moved->'rowLinks') e)
            SELECT 1 AS "Value" FROM accounting.partner_openings o WHERE o.partner_id={mainId} AND o.id NOT IN (SELECT id FROM logged)
                AND ((o.report_id,o.heading_position) IN (SELECT * FROM heading) OR (o.report_id,o.position) IN (SELECT * FROM row_link))
            """).AnyAsync(ct);
        if (confirmedSince)
            return Problem("Після об’єднання за рядком цієї картки у звірці підтверджено борг на основній картці. Скасувати вже не можна.");
        await db.Database.ExecuteSqlAsync($"""
            WITH m AS (SELECT moved FROM accounting.partner_merges WHERE duplicate_id={id}),
            logged_openings AS (SELECT (jsonb_array_elements_text(moved->'openings'))::uuid AS id FROM m),
            d AS (UPDATE accounting.documents SET native_partner_id={id} WHERE native_partner_id={mainId}
                AND id IN (SELECT (jsonb_array_elements_text(moved->'documents'))::uuid FROM m)),
            hl AS (UPDATE accounting.balance_partner_links l SET partner_id={id} WHERE l.partner_id={mainId}
                AND (l.report_id,l.heading_position) IN (SELECT (e->>0)::uuid,(e->>1)::bigint FROM m,jsonb_array_elements(m.moved->'headingLinks') e)),
            rl AS (UPDATE accounting.balance_row_links l SET partner_id={id} WHERE l.partner_id={mainId}
                AND (l.report_id,l.position) IN (SELECT (e->>0)::uuid,(e->>1)::bigint FROM m,jsonb_array_elements(m.moved->'rowLinks') e)),
            o AS (UPDATE accounting.partner_openings SET partner_id={id} WHERE partner_id={mainId}
                AND id IN (SELECT id FROM logged_openings)),
            so AS (UPDATE accounting.sales_offers SET partner_id={id} WHERE partner_id={mainId}
                AND id IN (SELECT (jsonb_array_elements_text(moved->'salesOffers'))::uuid FROM m)),
            ro AS (UPDATE accounting.recommendation_offers SET partner_id={id} WHERE partner_id={mainId}
                AND id IN (SELECT (jsonb_array_elements_text(moved->'recommendationOffers'))::uuid FROM m)),
            p AS (UPDATE accounting.partners SET merged_into=NULL WHERE id={id})
            DELETE FROM accounting.partner_merges WHERE duplicate_id={id}
            """, ct);
        audit.Record("accounting.partner_unmerged", "Partner", id.ToString(), new { MainId = mainId });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(mainId);
    }
}
