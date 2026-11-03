using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.Admin.Features.Integration;

internal static class GetIntegrationStatus
{
    public static async Task<Ok<IntegrationStatusDto>> HandleAsync(
        PoliValkoDbContext db,
        ICatalogFreshness freshness,
        [FromServices] INavkoloSettings navkolo,
        CancellationToken ct)
    {
        var states = await db.Set<SyncState>().AsNoTracking().ToDictionaryAsync(s => s.Job, ct);
        var jobs = SyncJobTitles.All.Keys.Union(states.Keys)
            .Select(job => states.TryGetValue(job, out var s)
                ? new SyncJobDto(job, SyncJobTitles.All.GetValueOrDefault(job, job), s.LastAttemptAt, s.LastSuccessAt, s.LastError, s.ConsecutiveFailures, s.RunRequestedAt)
                : new SyncJobDto(job, SyncJobTitles.All.GetValueOrDefault(job, job), null, null, null, 0, null))
            .ToList();
        var outbox = await db.OutboxMessages
            .Where(m => m.Status != OutboxStatus.Processed)
            .GroupBy(m => m.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        return TypedResults.Ok(new IntegrationStatusDto(
            navkolo.Mode,
            await freshness.IsFreshAsync(ct),
            jobs,
            outbox.GetValueOrDefault(OutboxStatus.Pending),
            outbox.GetValueOrDefault(OutboxStatus.Failed)));
    }
}
