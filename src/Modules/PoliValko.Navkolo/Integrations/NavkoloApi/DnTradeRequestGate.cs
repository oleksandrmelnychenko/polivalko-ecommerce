namespace PoliValko.Navkolo.Integrations.NavkoloApi;

// Shared by catalog, stock and outbox clients in this process. DNTrade allows 100 requests/minute.
internal sealed class DnTradeRequestGate(TimeProvider time)
{
    private readonly SemaphoreSlim _mutex = new(1, 1);
    private DateTimeOffset _next;

    public async Task WaitAsync(CancellationToken ct)
    {
        await _mutex.WaitAsync(ct);
        try
        {
            var delay = _next - time.GetUtcNow();
            if (delay > TimeSpan.Zero) await Task.Delay(delay, time, ct);
            _next = time.GetUtcNow() + TimeSpan.FromMilliseconds(750);
        }
        finally { _mutex.Release(); }
    }
}
