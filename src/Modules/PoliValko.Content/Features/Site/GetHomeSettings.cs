using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Content.Features.Site;

internal static class GetHomeSettings
{
    public static async Task<Ok<HomeSettingsDto>> HandleAsync(ISettingsStore settings, CancellationToken ct) =>
        TypedResults.Ok(await HomeSettingsStore.LoadAsync(settings, ct));
}
