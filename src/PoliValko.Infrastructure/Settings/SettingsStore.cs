using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Settings;

internal sealed class SettingsStore(PoliValkoDbContext db, SettingsCache cache, TimeProvider time) : ISettingsStore
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct)
    {
        if (!cache.TryGet(key, out var json))
        {
            json = await db.Set<PlatformSetting>().AsNoTracking().Where(s => s.Key == key).Select(s => s.Value).FirstOrDefaultAsync(ct);
            cache.Set(key, json);
        }

        return json is null ? default : JsonSerializer.Deserialize<T>(json, Json);
    }

    public async Task SaveAsync<T>(string key, T value, string updatedBy, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(value, Json);
        var now = time.GetUtcNow();
        var setting = await db.Set<PlatformSetting>().FirstOrDefaultAsync(s => s.Key == key, ct);
        if (setting is null)
        {
            db.Add(new PlatformSetting { Key = key, Value = json, UpdatedAt = now, UpdatedBy = updatedBy });
        }
        else
        {
            setting.Value = json;
            setting.UpdatedAt = now;
            setting.UpdatedBy = updatedBy;
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            cache.Invalidate(key);
        }
    }
}
