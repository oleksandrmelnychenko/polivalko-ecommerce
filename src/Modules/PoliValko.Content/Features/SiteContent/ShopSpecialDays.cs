using PoliValko.Infrastructure.Settings;
using PoliValko.SharedKernel;

namespace PoliValko.Content.Features.SiteContent;

internal static class ShopSpecialDays
{
    public const string SettingsKey = "settings.shop";

    public static async Task<IReadOnlyList<SpecialDayDto>> UpcomingAsync(ISettingsStore settings, TimeProvider time, CancellationToken ct)
    {
        var stored = await settings.GetAsync<Stored>(SettingsKey, ct);
        var today = KyivTime.Today(time);
        return (stored?.SpecialDays ?? [])
            .Where(d => d.Date >= today)
            .OrderBy(d => d.Date)
            .ToList();
    }

    internal sealed record Stored(IReadOnlyList<SpecialDayDto>? SpecialDays);
}
