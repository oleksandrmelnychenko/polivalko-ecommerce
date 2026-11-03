using Microsoft.Extensions.DependencyInjection;
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

    protected override bool IsEnabled(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.IsEnabled;

    protected override async Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct)
    {
        var records = await services.GetRequiredService<INavkoloClient>().GetCatalogAsync(ct);
        var result = await services.GetRequiredService<ICatalogImporter>().ImportProductsAsync(records, ct);
        return new SyncResult(result.Summary, result.Errors);
    }
}
