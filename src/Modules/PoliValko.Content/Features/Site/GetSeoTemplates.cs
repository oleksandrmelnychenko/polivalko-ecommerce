using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Content.Features.Site;

internal static class GetSeoTemplates
{
    public static async Task<Ok<SeoTemplatesDto>> HandleAsync(ISettingsStore settings, CancellationToken ct) =>
        TypedResults.Ok(await SeoTemplateSettings.LoadAsync(settings, ct));
}
