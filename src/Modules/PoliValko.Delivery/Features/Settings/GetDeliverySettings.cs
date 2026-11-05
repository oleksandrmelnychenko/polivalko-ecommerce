using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Delivery.Features.Settings;

internal static class GetDeliverySettings
{
    public static async Task<Ok<DeliverySettingsDto>> HandleAsync(ISettingsStore settings, CancellationToken ct) =>
        TypedResults.Ok(await DeliverySettingsStore.LoadAsync(settings, ct));
}
