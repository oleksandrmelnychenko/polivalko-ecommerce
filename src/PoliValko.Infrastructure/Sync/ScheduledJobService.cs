using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Sync;

public abstract class ScheduledJobService(IServiceScopeFactory scopes, TimeProvider time, ILogger logger) : BackgroundService
{
    public const string ScheduleActor = "Розклад";
    public const string RequestActor = "Запит з адмінки";

    protected abstract string Job { get; }

    protected abstract TimeSpan Interval(IServiceProvider services);

    protected abstract bool IsEnabled(IServiceProvider services);

    protected abstract Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct);

    protected virtual TimeSpan RetryInterval(IServiceProvider services) =>
        TimeSpan.FromTicks(Math.Min(Interval(services).Ticks, TimeSpan.FromMinutes(15).Ticks));

    protected virtual TimeSpan PollInterval => TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Завдання {Job}: збій планувальника", Job);
            }

            await Task.Delay(PollInterval, time, stoppingToken).ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var services = scope.ServiceProvider;
        if (!IsEnabled(services))
        {
            return;
        }

        var db = services.GetRequiredService<PoliValkoDbContext>();
        var now = time.GetUtcNow();
        var due = now - Interval(services);
        var retryDue = now - RetryInterval(services);

        await db.Database.ExecuteSqlAsync(
            $"INSERT INTO integration.sync_states (job, consecutive_failures) VALUES ({Job}, 0) ON CONFLICT DO NOTHING",
            ct);
        var requested = await db.Set<SyncState>()
            .AnyAsync(s => s.Job == Job && s.RunRequestedAt != null && (s.LastAttemptAt == null || s.RunRequestedAt > s.LastAttemptAt), ct);
        var claimed = await db.Database.ExecuteSqlAsync(
            $"""
            UPDATE integration.sync_states SET last_attempt_at = {now}
            WHERE job = {Job}
              AND (last_attempt_at IS NULL
                   OR last_attempt_at <= {due}
                   OR (consecutive_failures > 0 AND last_attempt_at <= {retryDue})
                   OR run_requested_at > last_attempt_at)
            """,
            ct);
        if (claimed == 0)
        {
            return;
        }

        await services.GetRequiredService<ISyncJournal>().RunAsync(
            Job,
            requested ? RequestActor : ScheduleActor,
            token => RunOnceAsync(services, token),
            ct);
    }
}
