using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering;
using PoliValko.Ordering.Domain;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Providers;

namespace PoliValko.Payments;

/// <summary>
/// Повернення коштів на картку (розділ 6 ТЗ). Ідемпотентне: повернення, що вже завершилося, не
/// повторюється; провайдер отримує ідентифікатор повернення як ключ операції.
/// </summary>
internal sealed class ProcessRefundRequested(
    PoliValkoDbContext db,
    IPaymentProviders providers,
    IOutbox outbox,
    TimeProvider time,
    ILogger<ProcessRefundRequested> logger) : IOutboxHandler<RefundRequested>
{
    public async Task HandleAsync(RefundRequested message, CancellationToken cancellationToken)
    {
        var order = await db.Set<Order>()
            .Include(o => o.Items)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery()
            .SingleAsync(o => o.Id == message.OrderId, cancellationToken);
        var refund = order.Refunds.Single(r => r.Id == message.RefundId);
        if (refund.Status != RefundStatus.Pending)
        {
            return;
        }

        var payment = await db.Set<Payment>()
            .Where(p => p.OrderId == order.Id && (p.Status == PaymentAttemptStatus.Succeeded || p.Status == PaymentAttemptStatus.Reversed))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var provider = payment is null ? null : providers.Find(payment.Provider);
        if (payment?.ProviderPaymentId is null || provider is null)
        {
            Fail(order, refund, "Не знайдено успішної оплати або її провайдер вимкнений.");
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var items = order.Items.ToDictionary(i => i.Id);
        var basket = refund.Lines
            .Select(l => new PaymentBasketItem(items[l.OrderItemId].Name, items[l.OrderItemId].Sku, l.Quantity, items[l.OrderItemId].UnitPrice))
            .ToList();
        var result = await provider.RefundAsync(payment.ProviderPaymentId, refund.Id, refund.Amount, basket, cancellationToken);

        if (result.Accepted)
        {
            refund.ProviderRef = result.ProviderRef;
            order.ApplySucceededRefund(refund, time.GetUtcNow());
            outbox.Enqueue(new FiscalReceiptRequested(order.Id, FiscalTrigger.Refund, refund.Id));
            logger.LogInformation("Повернення {Amount} за {Order} прийнято провайдером", refund.Amount, order.Number);
        }
        else
        {
            Fail(order, refund, result.Error ?? "Провайдер відхилив повернення.");
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private void Fail(Order order, OrderRefund refund, string error)
    {
        refund.Status = RefundStatus.Failed;
        refund.Error = error.Length > 1000 ? error[..1000] : error;
        refund.CompletedAt = time.GetUtcNow();
        outbox.Enqueue(new IntegrationAlert($"Повернення за {order.Number} не виконано", refund.Error));
    }
}

/// <summary>
/// Фонова звірка незавершених оплат зі статусом у провайдера: підхоплює втрачені вебхуки
/// й прострочені рахунки (розділ 6 ТЗ).
/// </summary>
internal sealed class PaymentReconciliationJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<PaymentReconciliationJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    public const string JobName = "payments.reconcile";

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
