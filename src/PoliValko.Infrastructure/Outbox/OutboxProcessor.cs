using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Infrastructure.Outbox;

public sealed class OutboxOptions
{
    public int BatchSize { get; set; } = 20;

    public int MaxAttempts { get; set; } = 10;

    public TimeSpan LockDuration { get; set; } = TimeSpan.FromMinutes(5);

    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(2);
}

public static class OutboxRetryPolicy
{
    private static readonly TimeSpan[] Delays =
    [
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromHours(1),
        TimeSpan.FromHours(3),
        TimeSpan.FromHours(6),
    ];

    /// <summary>Затримка перед наступною спробою після <paramref name="attempts"/> невдалих.</summary>
    public static TimeSpan NextDelay(int attempts) => Delays[Math.Clamp(attempts, 1, Delays.Length) - 1];
}

/// <summary>
/// Забирає пачку повідомлень з орендою (<c>FOR UPDATE SKIP LOCKED</c>), тому кілька екземплярів
/// Worker не обробляють одне повідомлення одночасно. Обробники мають бути ідемпотентними:
/// доставка гарантується «щонайменше один раз».
/// </summary>
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

                // Вичерпані спроби — критичний збій: відповідальний отримує повідомлення,
                // а операцію можна повторити вручну в адмінці (розділ 7 ТЗ).
                if (exhausted && message.Type != IntegrationAlert.Type)
                {
                    outbox.Enqueue(new IntegrationAlert(
                        "Операцію не виконано",
                        $"{message.Type}: {message.Attempts} невдалих спроб. Повторіть її в адмінці, розділ «Синхронізація». Помилка: {ex.Message}"));
                    await db.SaveChangesAsync(CancellationToken.None);
                }
            }
        }

        return batch.Count;
    }
}
