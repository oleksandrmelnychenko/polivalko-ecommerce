namespace PoliValko.Delivery.Features.Settings;

public sealed record NovaPoshtaSettingsDto(bool Enabled, bool CashOnDelivery);

public sealed record CourierSettingsDto(bool Enabled, string? Area, string? PriceNote);

public sealed record PickupSettingsDto(bool Enabled);

public sealed record DeliverySettingsDto(NovaPoshtaSettingsDto NovaPoshta, CourierSettingsDto Courier, PickupSettingsDto Pickup);
