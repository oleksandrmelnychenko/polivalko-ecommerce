using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Settings;
using PoliValko.Ordering.Configuration;
using PoliValko.Ordering.Features.Shop;

namespace PoliValko.Ordering.Features.Checkout;

internal static class GetSeller
{
    public static async Task<Ok<SellerDto>> HandleAsync(ISettingsStore settings, IOptions<SellerOptions> seller, CancellationToken ct)
    {
        var value = await ShopSettingsStore.LoadSellerAsync(settings, seller.Value, ct);
        return TypedResults.Ok(new SellerDto(value.Name, value.TaxId, value.Address, value.Iban, value.Email, value.Phone));
    }
}
