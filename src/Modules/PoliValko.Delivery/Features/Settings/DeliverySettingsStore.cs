using PoliValko.Infrastructure.Settings;

namespace PoliValko.Delivery.Features.Settings;

internal static class DeliverySettingsStore
{
    public const string SettingsKey = "settings.delivery";

    public static DeliverySettingsDto Defaults { get; } = new(
        new NovaPoshtaSettingsDto(true, true),
        new CourierSettingsDto(true, null, null),
        new PickupSettingsDto(true));

    public static async Task<DeliverySettingsDto> LoadAsync(ISettingsStore settings, CancellationToken ct)
    {
        var stored = await settings.GetAsync<DeliverySettingsDto>(SettingsKey, ct);
        return stored is null
            ? Defaults
            : new DeliverySettingsDto(
                stored.NovaPoshta ?? Defaults.NovaPoshta,
                stored.Courier ?? Defaults.Courier,
                stored.Pickup ?? Defaults.Pickup);
    }
}
