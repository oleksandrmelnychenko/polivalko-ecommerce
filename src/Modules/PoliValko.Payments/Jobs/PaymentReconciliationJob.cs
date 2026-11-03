using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Payments.Contracts;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Features.Processing;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Jobs;

internal sealed class PaymentReconciliationJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<PaymentReconciliationJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    public const string JobName = PaymentJobs.Reconcile;

    protected override string Job => JobName;

    protected override TimeSpan Interval(IServiceProvider services) => TimeSpan.FromMinutes(2);

    protected override bool IsEnabled(IServiceProvider services) => services.GetRequiredService<IPaymentProviders>().Active is not null;

    protected override async Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct)
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var providers = services.GetRequiredService<IPaymentProviders>();
        var processor = services.GetRequiredService<PaymentProcessor>();
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        var since = now - TimeSpan.FromDays(2);
        var settledBefore = now - TimeSpan.FromMinutes(1);

        var pending = await db.Set<Payment>()
            .AsNoTracking()
            .Where(p => (p.Status == PaymentAttemptStatus.Created || p.Status == PaymentAttemptStatus.Processing)
                        && p.ProviderPaymentId != null && p.CreatedAt > since && p.CreatedAt < settledBefore)
            .OrderBy(p => p.CreatedAt)
            .Take(200)
            .ToListAsync(ct);

        var errors = new List<SyncError>();
        var applied = 0;
        foreach (var payment in pending)
        {
            if (providers.Find(payment.Provider) is not { } provider)
            {
                continue;
            }

            try
            {
                var status = await provider.GetStatusAsync(payment.ProviderPaymentId!, ct);
                if (status.State is not (ProviderPaymentState.Created or ProviderPaymentState.Processing)
                    && await processor.ApplyAsync(provider.Name, status, "reconcile", null, ct) == PaymentUpdateResult.Applied)
                {
                    applied++;
                }
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                db.ChangeTracker.Clear();
                errors.Add(new SyncError(payment.OrderNumber, ex.Message));
            }
        }

        return new SyncResult($"Перевірено незавершених оплат: {pending.Count}, оновлено: {applied}", errors);
    }
}
