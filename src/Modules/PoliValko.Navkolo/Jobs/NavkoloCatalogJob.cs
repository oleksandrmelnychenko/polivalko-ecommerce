using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;
using PoliValko.Navkolo.Integrations.NavkoloApi;

namespace PoliValko.Navkolo.Jobs;

internal sealed class NavkoloCatalogJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<NavkoloCatalogJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    protected override string Job => NavkoloJobs.Catalog;

    protected override TimeSpan Interval(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.CatalogInterval;

    protected override bool IsEnabled(IServiceProvider services) => true;
    protected override async Task<bool> IsEnabledAsync(IServiceProvider services, CancellationToken ct) =>
        await services.GetRequiredService<INavkoloSettings>().GetModeAsync(ct) != NavkoloModes.Disabled;

    protected override async Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct)
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"navkolo.inventory-sync"}, 0))", ct);
        if (!await IsEnabledAsync(services, ct)) return new SyncResult("Синхронізацію вимкнено.", []);
        var records = await services.GetRequiredService<INavkoloClient>().GetCatalogAsync(ct);
        var result = await services.GetRequiredService<ICatalogImporter>().ImportProductsAsync(records, ct);
        if (result.Errors.Count > 0) throw new NavkoloUnavailableException($"Синхронізацію не застосовано: {result.Errors.Count} помилок даних каталогу.");
        await tx.CommitAsync(ct);
        return new SyncResult(result.Summary, result.Errors);
    }
}
