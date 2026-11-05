using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Content.Features.Site;

internal static class GetSiteHome
{
    public static async Task<Ok<SiteHomeDto>> HandleAsync(
        ISettingsStore settings,
        [FromServices] ActiveBanners banners,
        TimeProvider time,
        CancellationToken ct)
    {
        var home = await HomeSettingsStore.LoadAsync(settings, ct);
        var now = time.GetUtcNow();
        return TypedResults.Ok(new SiteHomeDto(
            HomeSettingsStore.IsLive(home.Announcement, now) ? home.Announcement : null,
            home.Blocks,
            home.Perks,
            home.Steps,
            home.Visit,
            await banners.GetLiveAsync(now, ct)));
    }
}
