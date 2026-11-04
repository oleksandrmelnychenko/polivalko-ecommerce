using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Infrastructure.Outbox;

public sealed class OutboxProcessor(
    PoliValkoDbContext db,
    IOutbox outbox,
    IServiceScopeFactory scopes,
    IOptions<OutboxHandlerRegistry> registry,
    IOptions<OutboxOptions> options,
    TimeProvider time,
    ILogger<OutboxProcessor> logger)
{
    public async Task<int> ProcessBatchAsync(CancellationToken ct)
    {
        var settings = options.Value;
        var now = time.GetUtcNow();
        var lockedUntil = now + settings.LockDuration;

        var batch = await db.OutboxMessages
            .FromSql($"""
                UPDATE integration.outbox_messages
                SET locked_until = {lockedUntil}, attempts = attempts + 1
                WHERE id IN (
                    SELECT id FROM integration.outbox_messages
                    WHERE status = 'Pending'
                      AND next_attempt_at <= {now}
                      AND (locked_until IS NULL OR locked_until < {now})
                    ORDER BY occurred_at
                    LIMIT {settings.BatchSize}
                    FOR UPDATE SKIP LOCKED)
                RETURNING *
                """)
            .AsNoTracking()
            .ToListAsync(ct);

        foreach (var message in batch.OrderBy(m => m.OccurredAt))
        {
            try
            {
                await using (var scope = scopes.CreateAsyncScope())
                {
                    await registry.Value.DispatchAsync(scope.ServiceProvider, message.Type, message.Payload, ct);
                }

                await db.OutboxMessages
                    .Where(m => m.Id == message.Id)
                    .ExecuteUpdateAsync(
                        s => s.SetProperty(m => m.Status, OutboxStatus.Processed)
                            .SetProperty(m => m.ProcessedAt, time.GetUtcNow())
                            .SetProperty(m => m.LockedUntil, (DateTimeOffset?)null)
                            .SetProperty(m => m.LastError, (string?)null),
                        ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                var exhausted = message.Attempts >= settings.MaxAttempts;
                var error = ex.ToString();

                await db.OutboxMessages
                    .Where(m => m.Id == message.Id)
                    .ExecuteUpdateAsync(
                        s => s.SetProperty(m => m.Status, exhausted ? OutboxStatus.Failed : OutboxStatus.Pending)
                            .SetProperty(m => m.NextAttemptAt, time.GetUtcNow() + OutboxRetryPolicy.NextDelay(message.Attempts))
                            .SetProperty(m => m.LockedUntil, (DateTimeOffset?)null)
                            .SetProperty(m => m.LastError, error.Length > 4000 ? error[..4000] : error),
                        CancellationToken.None);

                logger.LogWarning(
                    ex,
                    "Outbox: повідомлення {MessageId} ({Type}) не оброблено, спроба {Attempt}. Вичерпано: {Exhausted}",
                    message.Id,
                    message.Type,
                    message.Attempts,
                    exhausted);

                if (exhausted && message.Type != IntegrationAlert.Type)
                {
                    outbox.Enqueue(new IntegrationAlert(
                        "Операцію не виконано",
                        $"{message.Type}: {message.Attempts} невдалих спроб. Повторіть її в консолі, розділ «Синхронізація». Помилка: {ex.Message}"));
                    await db.SaveChangesAsync(CancellationToken.None);
                }
            }
        }

        return batch.Count;
    }
}
