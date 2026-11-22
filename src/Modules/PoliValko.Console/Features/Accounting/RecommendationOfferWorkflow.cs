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

internal static class RecommendationOfferWorkflow
{
    private sealed record Offer(Guid Id, Guid PartnerId, Guid ProductId, DateOnly LastPurchase, decimal Quantity,
        string Unit, decimal Price, string Status);

    internal static void Map(RouteGroupBuilder group)
    {
        var offers = group.MapGroup("/recommendation-offers").RequireAuthorization(
            PermissionRequirement.PolicyName([PermissionKeys.ProductAnalyticsView]),
            PermissionRequirement.PolicyName([PermissionKeys.ProductsView]),
            PermissionRequirement.PolicyName([PermissionKeys.AccountingEdit]));
        offers.MapPut("/{id:guid}", Issue).WithName("ConsoleIssueRecommendationOffer");
        offers.MapPut("/{id:guid}/decline", (Guid id, PoliValkoDbContext db, IAuditLog audit, IOutbox outbox, CancellationToken ct) =>
            Decide(id, "declined", db, audit, outbox, ct)).WithName("ConsoleDeclineRecommendationOffer");
        offers.MapPut("/{id:guid}/accept", (Guid id, PoliValkoDbContext db, IAuditLog audit, IOutbox outbox, CancellationToken ct) =>
            Decide(id, "reserved", db, audit, outbox, ct)).RequirePermission(PermissionKeys.AccountingPost).WithName("ConsoleAcceptRecommendationOffer");
        offers.MapPut("/{id:guid}/release", (Guid id, PoliValkoDbContext db, IAuditLog audit, IOutbox outbox, CancellationToken ct) =>
            Decide(id, "released", db, audit, outbox, ct)).RequirePermission(PermissionKeys.AccountingPost).WithName("ConsoleReleaseRecommendationReserve");
    }

    private static Task<Offer?> Find(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<Offer>($"""
            SELECT id,partner_id,product_id,last_purchase,quantity,unit,price,status
            FROM accounting.recommendation_offers WHERE id={id}
            """).SingleOrDefaultAsync(ct);

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

    private static async Task<IResult> Decide(Guid id, string target, PoliValkoDbContext db, IAuditLog audit,
        IOutbox outbox, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var offer = await Find(id, db, ct);
        if (offer is null) return Results.NotFound();
        await LockStock(db, offer.ProductId, ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM accounting.recommendation_offers WHERE id={id} FOR UPDATE", ct);
        offer = (await Find(id, db, ct))!;
        if (offer.Status == target) return Results.Ok(id);
        if (offer.Status != (target == "released" ? "reserved" : "offered"))
            return Conflict("Рішення щодо цієї пропозиції вже змінилося.");
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
            if (updated != 1) return Conflict("Для погодженої кількості бракує вільного залишку. Резерв не створено.");
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
