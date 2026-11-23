using Microsoft.Extensions.Caching.Memory;

namespace PoliValko.Catalog.Features.Storefront;

/// <summary>Keeps a costly answer in memory and lets requests that arrive together wait for one computation.</summary>
internal static class CachedLoad
{
    /// <param name="load">Computes the answer and tells whether it is worth keeping.</param>
    public static async Task<T> GetAsync<T>(IMemoryCache cache, object key, SemaphoreSlim gate, TimeSpan life,
        Func<Task<(T Value, bool Keep)>> load, CancellationToken ct) where T : class
    {
        if (cache.TryGetValue<T>(key, out var saved) && saved is not null) return saved;
        await gate.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue(key, out saved) && saved is not null) return saved;
            var (value, keep) = await load();
            return keep ? cache.Set(key, value, life) : value;
        }
        finally { gate.Release(); }
    }
}
