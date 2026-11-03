using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Delivery.Configuration;
using PoliValko.Delivery.Contracts;
using PoliValko.Delivery.Features.DirectorySync;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Delivery.Jobs;

internal sealed class NovaPoshtaSyncJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<NovaPoshtaSyncJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    public const string JobName = DeliveryJobs.NovaPoshtaDirectory;

    protected override string Job => JobName;

    protected override TimeSpan Interval(IServiceProvider services) =>
        services.GetRequiredService<IOptions<NovaPoshtaOptions>>().Value.SyncInterval;

    protected override bool IsEnabled(IServiceProvider services) =>
        services.GetRequiredService<IOptions<NovaPoshtaOptions>>().Value.IsConfigured;

    protected override Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct) =>
        services.GetRequiredService<NovaPoshtaDirectorySync>().RunAsync(ct);
}
