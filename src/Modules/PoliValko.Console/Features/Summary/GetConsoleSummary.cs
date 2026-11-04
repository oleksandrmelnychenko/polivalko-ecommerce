using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Content.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Contracts;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Console.Features.Summary;

internal static class GetConsoleSummary
{
    public static async Task<Ok<ConsoleSummaryDto>> HandleAsync(
        PoliValkoDbContext db,
        [FromServices] IOrderReporting orders,
        [FromServices] IServiceRequestStats serviceRequests,
        ICatalogFreshness freshness,
        CancellationToken ct)
    {
        var byStatus = await orders.CountOpenByStatusAsync(ct);
        var newRequests = await serviceRequests.CountNewAsync(ct);
        var pendingRefunds = await orders.CountPendingRefundsAsync(ct);
        var failed = await db.OutboxMessages.CountAsync(m => m.Status == OutboxStatus.Failed, ct);
        var lastSync = await db.Set<SyncState>().Where(s => s.Job == NavkoloJobs.PriceStock).Select(s => s.LastSuccessAt).FirstOrDefaultAsync(ct);

        return TypedResults.Ok(new ConsoleSummaryDto(
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
