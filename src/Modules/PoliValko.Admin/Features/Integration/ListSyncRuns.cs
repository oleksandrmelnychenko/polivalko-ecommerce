using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.Admin.Features.Integration;

internal static class ListSyncRuns
{
    public static async Task<Ok<List<ImportRunDto>>> HandleAsync(string? job, PoliValkoDbContext db, CancellationToken ct)
    {
        var runs = db.Set<SyncRun>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(job))
        {
            runs = runs.Where(r => r.Job == job);
        }

        var rows = await runs.OrderByDescending(r => r.StartedAt).Take(50).ToListAsync(ct);
        return TypedResults.Ok(rows.Select(ImportRunDto.From).ToList());
    }
}
