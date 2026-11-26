using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace PoliValko.Payments.Integrations.Mono;

internal sealed class MonoWebhookKeys(TimeProvider time, ILogger<MonoWebhookKeys> logger) : IDisposable
{
    private readonly SemaphoreSlim _refresh = new(1);
    private string? _key;
    private long? _lastRefresh;
    private TimeSpan _refreshInterval;

    private string? _owner;

    public string? Current => Volatile.Read(ref _key);

    /// <summary>Forgets the cached key when the merchant token is not the one it was fetched with.</summary>
    public async Task UseTokenAsync(string? token, CancellationToken ct)
    {
        var owner = token is null ? null : Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));
        if (Volatile.Read(ref _owner) == owner)
        {
            return;
        }

        await _refresh.WaitAsync(ct);
        try
        {
            if (_owner != owner)
            {
                _owner = owner;
                Volatile.Write(ref _key, null);
                _lastRefresh = null;
            }
        }
        finally
        {
            _refresh.Release();
        }
    }

    public async Task<string?> RefreshAsync(Func<CancellationToken, Task<string>> fetch, CancellationToken ct)
    {
        await _refresh.WaitAsync(ct);
        try
        {
            if (_lastRefresh is { } last && time.GetElapsedTime(last) < _refreshInterval)
                return Current;

            // The result is shared by all requests. A caller disconnecting must not cancel the fetch.
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5), time);
            try
            {
                var key = await fetch(deadline.Token);
                Volatile.Write(ref _key, key);
                _refreshInterval = TimeSpan.FromMinutes(5);
            }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or InvalidOperationException
                or JsonException or FormatException or CryptographicException or ArgumentException)
            {
                _refreshInterval = TimeSpan.FromSeconds(15);
                logger.LogWarning("Не вдалося оновити ключ monobank ({ErrorType})", ex.GetType().Name);
            }

            _lastRefresh = time.GetTimestamp();
            return Current;
        }
        finally
        {
            _refresh.Release();
        }
    }

    public void Dispose() => _refresh.Dispose();
}
