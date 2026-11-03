using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;
using PoliValko.Navkolo.Integrations.NavkoloApi;

namespace PoliValko.Navkolo.Jobs;

internal sealed class NavkoloPriceStockJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<NavkoloPriceStockJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    protected override string Job => NavkoloJobs.PriceStock;

    protected override TimeSpan Interval(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.SyncInterval;

    protected override TimeSpan RetryInterval(IServiceProvider services) => TimeSpan.FromMinutes(1);

    protected override bool IsEnabled(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.IsEnabled;

    protected override async Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct)
    {
        var records = await services.GetRequiredService<INavkoloClient>().GetPriceStockAsync(ct);
        var result = await services.GetRequiredService<ICatalogImporter>().ApplyPriceStockAsync(records, ct);
        return new SyncResult($"Отримано {records.Count} записів. Змінено: {result.Updated}, без змін: {result.Unchanged}", result.Errors);
    }
}
