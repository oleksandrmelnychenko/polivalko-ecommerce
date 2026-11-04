using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Infrastructure.Web;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.Console.Features.Integration;

internal static class RequestJobRun
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        string job,
        ISyncJournal journal,
        IAuditLog audit,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        if (!SyncJobTitles.All.ContainsKey(job) || job == NavkoloJobs.Import)
        {
            return Problems.NotFound("integration.job_not_found", "Завдання не знайдено");
        }

        await journal.RequestRunAsync(job, ct);
        audit.Record("integration.job_requested", "SyncJob", job);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }
}
