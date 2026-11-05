using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Settings;
using PoliValko.Ordering.Configuration;

namespace PoliValko.Ordering.Features.Shop;

internal static class GetShopSettings
{
    public static async Task<Ok<ShopSettingsDto>> HandleAsync(ISettingsStore settings, IOptions<SellerOptions> seller, CancellationToken ct) =>
        TypedResults.Ok(await ShopSettingsStore.LoadAsync(settings, seller.Value, ct));
}
