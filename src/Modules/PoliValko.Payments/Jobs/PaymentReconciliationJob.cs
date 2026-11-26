using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Contracts;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Features.Processing;
using PoliValko.Payments.Features.Refunds;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Jobs;

internal sealed class PaymentReconciliationJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<PaymentReconciliationJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    public const string JobName = PaymentJobs.Reconcile;

    protected override string Job => JobName;

    private static readonly TimeSpan ExpiryGrace = TimeSpan.FromMinutes(15);

    protected override TimeSpan Interval(IServiceProvider services) => TimeSpan.FromMinutes(2);

    // Always on: a bank switched off in the console still has payments and refunds to settle.
    protected override bool IsEnabled(IServiceProvider services) => true;

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
                if (status.State == ProviderPaymentState.Created && payment.ExpiresAt + ExpiryGrace < now)
                {
                    // LiqPay keeps no trace of a checkout page nobody paid on; past its deadline it can no longer take money.
                    status = new ProviderPaymentStatus(status.ProviderPaymentId, ProviderPaymentState.Expired, null, payment.ExpiresAt, "Час на оплату минув");
                }

                if (status.State is not (ProviderPaymentState.Created or ProviderPaymentState.Processing)
                    && await processor.ApplyAsync(provider.Name, status, "reconcile", null, ct) == PaymentUpdateResult.Applied)
                {
                    applied++;
                }
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                errors.Add(new SyncError(payment.OrderNumber, ex.Message));
            }
            finally
            {
                db.ChangeTracker.Clear();
            }
        }

        // Refunds the provider accepted as processing settle here; a refund is never sent again from this job.
        var settlement = services.GetRequiredService<RefundSettlement>();
        var refunds = await services.GetRequiredService<IOrderPayments>().ListSubmittedRefundsAsync(settledBefore, 100, ct);
        var settled = 0;
        foreach (var refund in refunds)
        {
            try
            {
                if (await settlement.ReconcileAsync(refund.OrderId, refund.RefundId, ct))
                {
                    settled++;
                }
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                errors.Add(new SyncError(refund.OrderNumber, ex.Message));
            }
            finally
            {
                db.ChangeTracker.Clear();
            }
        }

        return new SyncResult(
            $"Перевірено незавершених оплат: {pending.Count}, оновлено: {applied}; повернень в обробці: {refunds.Count}, завершено: {settled}",
            errors);
    }
}
