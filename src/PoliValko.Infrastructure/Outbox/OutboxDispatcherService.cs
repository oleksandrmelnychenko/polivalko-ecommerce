using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace PoliValko.Infrastructure.Outbox;

internal sealed class OutboxDispatcherService(
    IServiceScopeFactory scopes,
    IOptions<OutboxOptions> options,
    TimeProvider time,
    ILogger<OutboxDispatcherService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                int processed;
                await using (var scope = scopes.CreateAsyncScope())
                {
                    processed = await scope.ServiceProvider.GetRequiredService<OutboxProcessor>()
                        .ProcessBatchAsync(stoppingToken);
                }

                if (processed == 0)
                {
                    await Task.Delay(options.Value.PollInterval, time, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Outbox: збій циклу обробки");
                await Task.Delay(options.Value.PollInterval, time, stoppingToken).ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
            }
        }
    }
}
