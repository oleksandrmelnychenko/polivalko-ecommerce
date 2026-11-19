using Microsoft.Extensions.Logging.Abstractions;
using PoliValko.Payments.Integrations.Mono;

namespace PoliValko.UnitTests.Payments;

public sealed class MonoWebhookKeysTests
{
    [Fact]
    public async Task Concurrent_consumers_share_the_refresh_even_if_the_first_stops_waiting()
    {
        var ct = TestContext.Current.CancellationToken;
        using var keys = new MonoWebhookKeys(TimeProvider.System, NullLogger<MonoWebhookKeys>.Instance);
        using var firstRequest = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var response = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = 0;

        async Task<string> Fetch(CancellationToken timeout)
        {
            Interlocked.Increment(ref calls);
            started.TrySetResult();
            return await response.Task.WaitAsync(timeout);
        }

        var first = keys.RefreshAsync(Fetch, firstRequest.Token);
        await started.Task.WaitAsync(ct);
        var second = keys.RefreshAsync(Fetch, ct);
        await firstRequest.CancelAsync();
        response.SetResult("test-key");

        (await second).ShouldBe("test-key");
        await first;
        keys.Current.ShouldBe("test-key");
        calls.ShouldBe(1);
    }
}
