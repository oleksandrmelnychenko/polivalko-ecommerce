using PoliValko.Delivery.Contracts;
using PoliValko.Delivery.Features.Directory;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Delivery.Features.Settings;

internal sealed class DeliveryAvailabilityReader(ISettingsStore settings, PickupPointStore pickup) : IDeliveryAvailability
{
    public async Task<DeliveryAvailability> GetAsync(CancellationToken ct)
    {
        var value = await DeliverySettingsStore.LoadAsync(settings, ct);
        var point = value.Pickup.Enabled ? (await pickup.GetActiveAsync(ct)).FirstOrDefault() : null;
        return new DeliveryAvailability(
            value.NovaPoshta.Enabled,
            value.NovaPoshta.CashOnDelivery,
            value.Courier.Enabled,
            value.Courier.Area,
            value.Courier.PriceNote,
            point);
    }
}
