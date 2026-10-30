using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo;
using PoliValko.Ordering.Domain;

namespace PoliValko.Api;

/// <summary>Лічильники для першого екрана адмінки. Лише реальні дані, без вигаданих метрик.</summary>
public sealed record AdminSummaryDto(
    int NewOrders,
    int AwaitingPayment,
    int AwaitingConfirmation,
    int NewServiceRequests,
    int PendingRefunds,
    int FailedOperations,
    bool CatalogDataFresh,
    DateTimeOffset? LastPriceSync);

internal static class AdminSummary
{
    // Зведення читає кілька модулів, тому живе в хості API, а не в одному з модулів.
    public static RouteGroupBuilder MapAdminSummary(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/summary").WithTags("Admin").RequireStaff()
            .MapGet(string.Empty, GetAsync)
            .WithName("AdminSummary")
            .WithSummary("Нові замовлення, очікують оплати чи підтвердження, заявки, повернення, збої інтеграцій");
        return admin;
    }

    private static async Task<Ok<AdminSummaryDto>> GetAsync(PoliValkoDbContext db, ICatalogFreshness freshness, CancellationToken ct)
    {
        var byStatus = await db.Set<Order>()
            .Where(o => o.Status == OrderStatus.New || o.Status == OrderStatus.AwaitingPayment || o.Status == OrderStatus.AwaitingConfirmation)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, ct);
        var newRequests = await db.Set<ServiceRequest>().CountAsync(r => r.Status == ServiceRequestStatus.New, ct);
        var pendingRefunds = await db.Set<OrderRefund>().CountAsync(r => r.Status == RefundStatus.Pending, ct);
        var failed = await db.OutboxMessages.CountAsync(m => m.Status == OutboxStatus.Failed, ct);
        var lastSync = await db.Set<SyncState>().Where(s => s.Job == NavkoloJobs.PriceStock).Select(s => s.LastSuccessAt).FirstOrDefaultAsync(ct);

        return TypedResults.Ok(new AdminSummaryDto(
            byStatus.GetValueOrDefault(OrderStatus.New),
            byStatus.GetValueOrDefault(OrderStatus.AwaitingPayment),
            byStatus.GetValueOrDefault(OrderStatus.AwaitingConfirmation),
            newRequests,
            pendingRefunds,
            failed,
            await freshness.IsFreshAsync(ct),
            lastSync));
    }
}
