using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Console.Features.Analytics;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Console.Features.Accounting;

public sealed record RecommendationOfferRequest(Guid PartnerId, Guid ProductId, DateOnly LastPurchase, int Days,
    decimal Quantity, string Unit, decimal Price);
public sealed record OfferInvoiceSource(Guid? OrganizationId, Guid? StoreId);
public sealed record OfferQuantityRequest(decimal Quantity);

internal static class RecommendationOfferWorkflow
{
    internal sealed record Offer(Guid Id, Guid PartnerId, Guid ProductId, DateOnly LastPurchase, decimal Quantity,
        string Unit, decimal Price, string Status, Guid? InvoiceId);
    private sealed record InvoiceNumber(DateOnly Day, long Number);

    internal static void Map(RouteGroupBuilder group)
    {
        var offers = group.MapGroup("/recommendation-offers").RequireAuthorization(
            PermissionRequirement.PolicyName([PermissionKeys.ProductAnalyticsView]),
            PermissionRequirement.PolicyName([PermissionKeys.ProductsView]),
            PermissionRequirement.PolicyName([PermissionKeys.AccountingEdit]));
        offers.MapPut("/{id:guid}", Issue).WithName("ConsoleIssueRecommendationOffer");
        offers.MapPut("/{id:guid}/invoice", CreateInvoice).WithName("ConsoleCreateRecommendationInvoice").Produces<Guid>();
        offers.MapPut("/{id:guid}/quantity", Amend).WithName("ConsoleAmendRecommendationOffer");
        offers.MapPut("/{id:guid}/reopen", Reopen).WithName("ConsoleReopenRecommendationOffer");
        offers.MapPut("/{id:guid}/decline", (Guid id, PoliValkoDbContext db, IAuditLog audit, IOutbox outbox, CancellationToken ct) =>
            Decide(id, "declined", db, audit, outbox, ct)).WithName("ConsoleDeclineRecommendationOffer");
        offers.MapPut("/{id:guid}/accept", (Guid id, PoliValkoDbContext db, IAuditLog audit, IOutbox outbox, CancellationToken ct) =>
            Decide(id, "reserved", db, audit, outbox, ct)).RequirePermission(PermissionKeys.AccountingPost).WithName("ConsoleAcceptRecommendationOffer");
        offers.MapPut("/{id:guid}/release", (Guid id, PoliValkoDbContext db, IAuditLog audit, IOutbox outbox, CancellationToken ct) =>
            Decide(id, "released", db, audit, outbox, ct)).RequirePermission(PermissionKeys.AccountingPost).WithName("ConsoleReleaseRecommendationReserve");
    }

    private static IQueryable<Offer> Offers(PoliValkoDbContext db) =>
        db.Database.SqlQuery<Offer>($"""
            SELECT id,partner_id,product_id,last_purchase,quantity,unit,price,status,invoice_id
            FROM accounting.recommendation_offers
            """);

    private static Task<Offer?> Find(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        Offers(db).SingleOrDefaultAsync(o => o.Id == id, ct);

    internal static Task<Offer?> ForInvoice(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        Offers(db).SingleOrDefaultAsync(o => o.InvoiceId == id, ct);

    internal static Task<OfferInvoiceSource?> StockSource(Guid productId, PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<OfferInvoiceSource>($"""
            SELECT warehouse_org_id AS organization_id,warehouse_store_id AS store_id FROM catalog.product_stock
            WHERE product_id={productId}
            """).SingleOrDefaultAsync(ct);

    private static async Task<IResult> CreateInvoice(Guid id, OfferInvoiceSource input, PoliValkoDbContext db,
        IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM accounting.recommendation_offers WHERE id={id} FOR UPDATE", ct);
        var offer = await Find(id, db, ct);
        if (offer == null) return Results.NotFound();
        if (offer.InvoiceId is Guid existing) return Results.Ok(existing);
        if (offer.Status != "reserved") return Conflict("Створити накладну можна після погодження і резервування товару.");
        var source = await StockSource(offer.ProductId, db, ct);
        var org = source?.OrganizationId ?? input.OrganizationId;
        var store = source?.StoreId ?? input.StoreId;
        if (org == null || store == null) return Conflict("Виберіть організацію та склад відвантаження.");
        if ((input.OrganizationId.HasValue && input.OrganizationId != org) || (input.StoreId.HasValue && input.StoreId != store))
            return Conflict("Джерело залишку змінилося. Оновіть журнал і перевірте склад.");
        var invoiceId = Guid.NewGuid();
        var number = await db.Database.SqlQuery<InvoiceNumber>($"""
            SELECT (now() AT TIME ZONE 'Europe/Kyiv')::date AS day,nextval('accounting.recommendation_invoice_number') AS number
            """).SingleAsync(ct);
        var draft = new NewDraft(invoiceId, offer.PartnerId, "out", $"РП-{number.Day:yyyy}-{number.Number:D6}", number.Day,
            org.Value.ToString(), store.Value.ToString(), [new(offer.ProductId, offer.Quantity, offer.Price)]);
        var result = await AccountingEntry.SaveDraftInTransaction(draft, null, db, audit, ct);
        if (result is not Microsoft.AspNetCore.Http.HttpResults.Ok<Guid>) return result;
        await db.Database.ExecuteSqlAsync($"UPDATE accounting.recommendation_offers SET invoice_id={invoiceId},changed_at=now() WHERE id={id}",ct);
        audit.Record("recommendation.invoice_created","RecommendationOffer",id.ToString(), new { invoiceId });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return result;
    }

    private static IResult Conflict(string title) => Results.Conflict(new { title });

    private static IResult Replay(Offer offer, RecommendationOfferRequest input) =>
        offer.PartnerId == input.PartnerId && offer.ProductId == input.ProductId && offer.LastPurchase == input.LastPurchase &&
        offer.Quantity == input.Quantity && offer.Price == input.Price && offer.Unit == input.Unit
            ? Results.Ok(offer.Id) : Conflict("Цей запис уже належить іншій пропозиції.");

    private static async Task<IResult> Issue(Guid id, RecommendationOfferRequest input, BusinessAnalyticsClient analytics,
        PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        if (id == Guid.Empty || input.PartnerId == Guid.Empty || input.ProductId == Guid.Empty ||
            input.Days is not (7 or 30 or 90) || input.Quantity <= 0 || input.Price <= 0) return Results.BadRequest();
        var existing = await Find(id, db, ct);
        if (existing is not null) return Replay(existing, input);
        BusinessAnalyticsClient.OfferItem? item;
        try { item = await analytics.FindOffer(input.PartnerId, input.ProductId, input.Days, ct); }
        catch (HttpRequestException) { return Results.Problem(statusCode: 503, title: "Не вдалося звірити чергу пропозицій."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { return Results.Problem(statusCode: 503, title: "Звірка черги тимчасово недоступна."); }
        if (item is null || item.OfferId.HasValue || item.Last != input.LastPurchase || item.Quantity != input.Quantity ||
            item.Unit != input.Unit || item.Price != input.Price)
        {
            existing = await Find(id, db, ct);
            return existing is null ? Conflict("Рекомендація змінилася. Перегляньте оновлену чергу.") : Replay(existing, input);
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockStock(db, input.ProductId, ct);
        var created = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.recommendation_offers(id,partner_id,product_id,last_purchase,quantity,unit,price,status)
            SELECT {id},{input.PartnerId},s.product_id,{item.Last},{item.Quantity},{item.Unit},{item.Price},'offered'
            FROM catalog.product_stock s JOIN catalog.products p ON p.id=s.product_id AND NOT p.is_archived
            JOIN catalog.product_prices pr ON pr.product_id=s.product_id AND pr.amount={item.Price}
            WHERE s.product_id={input.ProductId} AND s.quantity-s.reserved_quantity >= {item.Quantity} +
              (SELECT coalesce(sum(quantity),0) FROM accounting.recommendation_offers
               WHERE product_id=s.product_id AND status='offered')
            ON CONFLICT DO NOTHING
            """, ct);
        if (created == 0)
        {
            existing = await Find(id, db, ct);
            return existing is null ? Conflict("Залишок або стан пропозиції змінився. Чергу оновлено.") : Replay(existing, input);
        }
        audit.Record("recommendation.offered","RecommendationOffer",id.ToString(), input);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static Task LockStock(PoliValkoDbContext db, Guid productId, CancellationToken ct) =>
        db.Database.ExecuteSqlAsync($"SELECT 1 FROM catalog.product_stock WHERE product_id={productId} FOR UPDATE", ct);

    private static bool Usable(decimal quantity) =>
        quantity > 0 && quantity <= 999_999_999.999m && decimal.Round(quantity, 3) == quantity;

    // An unanswered offer holds no reservation: its quantity is only promised in the queue. Changing it
    // therefore moves no stock. A smaller quantity is always possible; a larger one must still fit
    // beside the other unanswered offers, as a new offer must.
    private static async Task<IResult> Amend(Guid id, OfferQuantityRequest input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        if (!Usable(input.Quantity)) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var offer = await Find(id, db, ct);
        if (offer is null) return Results.NotFound();
        await LockStock(db, offer.ProductId, ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM accounting.recommendation_offers WHERE id={id} FOR UPDATE", ct);
        offer = (await Find(id, db, ct))!;
        if (offer.Status != "offered") return Conflict("Кількість можна змінити лише до відповіді клієнта.");
        if (offer.Quantity == input.Quantity) return Results.Ok(id);
        var changed = await db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.recommendation_offers o SET quantity={input.Quantity},changed_at=now()
            FROM catalog.product_stock s
            WHERE o.id={id} AND o.status='offered' AND s.product_id=o.product_id
              AND ({input.Quantity} < o.quantity OR s.quantity-s.reserved_quantity >= {input.Quantity} +
                (SELECT coalesce(sum(pending.quantity),0) FROM accounting.recommendation_offers pending
                 WHERE pending.product_id=o.product_id AND pending.status='offered' AND pending.id<>o.id))
            """, ct);
        if (changed != 1) return Conflict("Для такої кількості бракує вільного залишку.");
        audit.Record("recommendation.amended", "RecommendationOffer", id.ToString(), new { offer.PartnerId, offer.ProductId, From = offer.Quantity, To = input.Quantity });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    // A declined offer never held stock and a released one has given it back, so bringing either
    // back to "offered" moves no stock. It is offered again as a new offer would be: at today's price,
    // for a product that is still on sale, within the stock that other unanswered offers leave free.
    // The link to a cancelled draft is dropped; a new draft is created after the customer agrees.
    private static async Task<IResult> Reopen(Guid id, OfferQuantityRequest input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        if (!Usable(input.Quantity)) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var offer = await Find(id, db, ct);
        if (offer is null) return Results.NotFound();
        await LockStock(db, offer.ProductId, ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM accounting.recommendation_offers WHERE id={id} FOR UPDATE", ct);
        offer = (await Find(id, db, ct))!;
        if (offer.Status == "offered" && offer.Quantity == input.Quantity) return Results.Ok(id);
        if (offer.Status is not ("declined" or "released"))
            return Conflict("Повернути можна лише пропозицію, від якої відмовилися або з якої знято резерв.");
        var open = await db.Database.SqlQuery<int>($"""
            SELECT count(*)::int AS "Value" FROM accounting.recommendation_offers
            WHERE product_id={offer.ProductId} AND partner_id={offer.PartnerId} AND id<>{id} AND status IN ('offered','reserved')
            """).SingleAsync(ct);
        if (open > 0) return Conflict("Цьому клієнтові вже зроблено новішу пропозицію цього товару.");
        var reopened = await db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.recommendation_offers o
            SET status='offered',invoice_id=NULL,quantity={input.Quantity},price=pr.amount,changed_at=now()
            FROM catalog.product_stock s
            JOIN catalog.products p ON p.id=s.product_id AND NOT p.is_archived
            JOIN catalog.product_prices pr ON pr.product_id=s.product_id AND pr.amount>0
            WHERE o.id={id} AND o.status IN ('declined','released') AND s.product_id=o.product_id
              AND s.quantity-s.reserved_quantity >= {input.Quantity} +
                (SELECT coalesce(sum(pending.quantity),0) FROM accounting.recommendation_offers pending
                 WHERE pending.product_id=o.product_id AND pending.status='offered')
            """, ct);
        if (reopened != 1)
        {
            var archived = await db.Database.SqlQuery<bool>($"""
                SELECT is_archived AS "Value" FROM catalog.products WHERE id={offer.ProductId}
                """).SingleOrDefaultAsync(ct);
            return Conflict(archived
                ? "Товар перенесено в архів, тому пропозицію не повернуто."
                : "Для такої кількості бракує вільного залишку або товар не має ціни.");
        }
        audit.Record("recommendation.reopened", "RecommendationOffer", id.ToString(),
            new { offer.PartnerId, offer.ProductId, From = offer.Status, input.Quantity });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static async Task<IResult> Decide(Guid id, string target, PoliValkoDbContext db, IAuditLog audit,
        IOutbox outbox, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var offer = await Find(id, db, ct);
        if (offer is null) return Results.NotFound();
        var linked = offer.InvoiceId;
        // Posting locks the document before stock. Cancellation follows the same order.
        if (target == "released" && linked is Guid document)
            await db.Database.ExecuteSqlAsync($"SELECT 1 FROM accounting.documents WHERE id={document} FOR UPDATE", ct);
        await LockStock(db, offer.ProductId, ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM accounting.recommendation_offers WHERE id={id} FOR UPDATE", ct);
        offer = (await Find(id, db, ct))!;
        if (offer.Status == target) return Results.Ok(id);
        if (offer.Status != (target == "released" ? "reserved" : "offered"))
            return Conflict("Рішення щодо цієї пропозиції вже змінилося.");
        if (target == "released" && offer.InvoiceId is Guid draft)
        {
            if (linked != draft) return Conflict("Для пропозиції щойно створено накладну. Перевірте чернетку перед зняттям резерву.");
            if (await db.Database.ExecuteSqlAsync($"UPDATE accounting.documents SET status='cancelled' WHERE id={draft} AND status='draft'",ct) != 1)
                return Conflict("Перевірте стан накладної перед зняттям резерву.");
            audit.Record("accounting.draft_cancelled","AccountingDocument",draft.ToString(),new { offerId=id });
        }
        if (target == "reserved")
        {
            var updated = await db.Database.ExecuteSqlAsync($"""
                UPDATE catalog.product_stock s SET reserved_quantity=reserved_quantity+{offer.Quantity}, updated_at=now()
                WHERE s.product_id={offer.ProductId} AND EXISTS
                  (SELECT 1 FROM catalog.products p WHERE p.id=s.product_id AND NOT p.is_archived)
                AND s.quantity-s.reserved_quantity >= {offer.Quantity} +
                  (SELECT coalesce(sum(other.quantity),0) FROM accounting.recommendation_offers other
                   JOIN accounting.recommendation_offers current_offer ON current_offer.id={id}
                   WHERE other.product_id=s.product_id AND other.status='offered'
                     AND (other.offered_at,other.id)<(current_offer.offered_at,current_offer.id))
                """, ct);
            if (updated != 1)
            {
                // The update refuses an archived product as well as a shortage. Name the one that happened:
                // waiting for stock does not help when the product has left the catalog.
                var archived = await db.Database.SqlQuery<bool>($"""
                    SELECT is_archived AS "Value" FROM catalog.products WHERE id={offer.ProductId}
                    """).SingleOrDefaultAsync(ct);
                return Conflict(archived
                    ? "Товар перенесено в архів, тому резерв не створено. Поверніть товар з архіву або позначте, що клієнт відмовився."
                    : "Для погодженої кількості бракує вільного залишку. Резерв не створено.");
            }
        }
        if (target == "released" && await db.Database.ExecuteSqlAsync($"""
            UPDATE catalog.product_stock SET reserved_quantity=reserved_quantity-{offer.Quantity}, updated_at=now()
            WHERE product_id={offer.ProductId} AND reserved_quantity>={offer.Quantity}
            """, ct) != 1) return Conflict("Залишок резерву потребує звірки.");
        await db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.recommendation_offers SET status={target},changed_at=now() WHERE id={id}
            """, ct);
        if (target is "reserved" or "released") outbox.Enqueue(new StockAvailabilityChanged());
        audit.Record("recommendation." + target, "RecommendationOffer", id.ToString(), new { offer.PartnerId, offer.ProductId, offer.Quantity });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }
}
