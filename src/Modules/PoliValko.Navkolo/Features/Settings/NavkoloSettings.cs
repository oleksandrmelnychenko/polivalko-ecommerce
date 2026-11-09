using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.Navkolo.Features.Settings;

internal sealed class NavkoloSettings(PoliValkoDbContext db, IDataProtectionProvider protection, IOptions<NavkoloOptions> defaults) : INavkoloSettings
{
    internal const string Key = "navkolo.connection.v1";
    internal const string Purpose = "PoliValko.Navkolo.ApiKey.v1";
    internal sealed record Stored(Guid Revision, string Mode, string? ProtectedKey, string? StoreId, string? StoreName, DateTimeOffset? VerifiedAt, int? CancellationStatusId = null, string? CancellationStatusName = null);

    public async Task<Stored?> ReadAsync(CancellationToken ct)
    {
        // Deliberately bypass the process-local settings cache: API and Worker see committed changes immediately.
        var json = await db.Set<PlatformSetting>().AsNoTracking().Where(s => s.Key == Key).Select(s => s.Value).SingleOrDefaultAsync(ct);
        return json is null ? null : JsonSerializer.Deserialize<Stored>(json);
    }

    public async Task<NavkoloOptions> LoadAsync(CancellationToken ct)
    {
        var stored = await ReadAsync(ct);
        var value = defaults.Value;
        if (stored is null) return value;
        return new NavkoloOptions
        {
            Mode = stored.Mode, StoreId = stored.StoreId, CancellationStatusId = stored.CancellationStatusId,
            ApiKey = stored.ProtectedKey is null ? "" : protection.CreateProtector(Purpose).Unprotect(stored.ProtectedKey),
            Channel = value.Channel, OrderStatusId = value.OrderStatusId, SyncInterval = value.SyncInterval,
            CatalogInterval = value.CatalogInterval, FreshnessThreshold = value.FreshnessThreshold, Stub = value.Stub,
        };
    }

    public async Task<string> GetModeAsync(CancellationToken ct) => (await ReadAsync(ct))?.Mode ?? defaults.Value.Mode;
    public string Protect(string key) => protection.CreateProtector(Purpose).Protect(key);
}
