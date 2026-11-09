using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.Navkolo.Jobs;

internal sealed class NavkoloPriceStockJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<NavkoloPriceStockJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    protected override string Job => NavkoloJobs.PriceStock;

    protected override TimeSpan Interval(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.SyncInterval;

    protected override TimeSpan RetryInterval(IServiceProvider services) => TimeSpan.FromMinutes(1);

    protected override bool IsEnabled(IServiceProvider services) => true;
    protected override async Task<bool> IsEnabledAsync(IServiceProvider services, CancellationToken ct) =>
        await services.GetRequiredService<INavkoloSettings>().GetModeAsync(ct) != NavkoloModes.Disabled;

    protected override Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct) =>
        services.GetRequiredService<Features.OrderSync.NavkoloInventorySync>().RunAsync(ct);
}
