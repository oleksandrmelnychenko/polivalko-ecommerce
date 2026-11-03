using PoliValko.Delivery.Domain;

namespace PoliValko.Delivery.Features.Admin;

internal static class AdminPickupPointMapping
{
    public static AdminPickupPointDto ToDto(PickupLocation p) =>
        new(p.Code, p.Name, p.Address, p.Schedule, p.Instructions, p.MapUrl, p.IsActive);
}
