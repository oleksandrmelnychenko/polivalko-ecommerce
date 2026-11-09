using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.Navkolo.Features.Freshness;

internal sealed class NavkoloFreshness(PoliValkoDbContext db, IOptions<NavkoloOptions> options, Features.Settings.NavkoloSettings settings, TimeProvider time) : ICatalogFreshness
{
    public async Task<bool> IsFreshAsync(CancellationToken ct)
    {
        if (await settings.GetModeAsync(ct) == NavkoloModes.Disabled) return await settings.ReadAsync(ct) is null;
        var lastSuccess = await db.Set<SyncState>()
            .AsNoTracking()
            .Where(s => s.Job == NavkoloJobs.PriceStock)
            .Select(s => s.LastSuccessAt)
            .FirstOrDefaultAsync(ct);
        return lastSuccess is { } at && time.GetUtcNow() - at <= options.Value.FreshnessThreshold;
    }
}
