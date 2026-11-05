using System.Collections.Concurrent;

namespace PoliValko.Infrastructure.Settings;

internal sealed class SettingsCache(TimeProvider time)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(30);

    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.Ordinal);

    public bool TryGet(string key, out string? json)
    {
        if (_entries.TryGetValue(key, out var entry) && entry.ExpiresAt > time.GetUtcNow())
        {
            json = entry.Json;
            return true;
        }

        json = null;
        return false;
    }

    public void Set(string key, string? json) => _entries[key] = new Entry(json, time.GetUtcNow() + Lifetime);

    public void Invalidate(string key) => _entries.TryRemove(key, out _);

    private sealed record Entry(string? Json, DateTimeOffset ExpiresAt);
}
