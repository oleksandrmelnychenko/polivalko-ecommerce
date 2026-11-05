using PoliValko.Infrastructure.Settings;
using PoliValko.Ordering.Configuration;

namespace PoliValko.Ordering.Features.Shop;

internal static class ShopSettingsStore
{
    public const string SettingsKey = "settings.shop";

    public static async Task<ShopSettingsDto> LoadAsync(ISettingsStore settings, SellerOptions fallback, CancellationToken ct)
    {
        var stored = await settings.GetAsync<ShopSettingsDto>(SettingsKey, ct);
        return new ShopSettingsDto(
            stored?.Seller is { Name.Length: > 0 } seller ? seller : FromOptions(fallback),
            (stored?.SpecialDays ?? []).OrderBy(d => d.Date).ToList());
    }

    public static async Task<ShopSellerDto> LoadSellerAsync(ISettingsStore settings, SellerOptions fallback, CancellationToken ct) =>
        (await LoadAsync(settings, fallback, ct)).Seller;

    private static ShopSellerDto FromOptions(SellerOptions options) =>
        new(options.Name, options.TaxId, options.Address, null, null, null);
}
