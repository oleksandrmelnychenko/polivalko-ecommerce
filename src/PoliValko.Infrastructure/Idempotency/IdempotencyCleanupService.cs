using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Idempotency;

/// <summary>Щогодини видаляє ключі ідемпотентності, старші за 72 години.</summary>
internal sealed class IdempotencyCleanupService(
    IServiceScopeFactory scopes,
    TimeProvider time,
    ILogger<IdempotencyCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Retention = TimeSpan.FromHours(72);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1), time);
        try
        {
            do
            {
                await CleanupAsync(stoppingToken);
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<PoliValkoDbContext>();
            var threshold = time.GetUtcNow() - Retention;
            var deleted = await db.IdempotencyRecords.Where(r => r.CreatedAt < threshold).ExecuteDeleteAsync(ct);
            if (deleted > 0)
            {
                logger.LogInformation("Видалено {Count} застарілих ключів ідемпотентності", deleted);
            }
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Збій очищення ключів ідемпотентності");
        }
    }
}
