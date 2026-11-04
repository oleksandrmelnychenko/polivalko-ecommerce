using PoliValko.Delivery.Domain;

namespace PoliValko.Delivery.Features.Console;

internal static class ConsolePickupPointMapping
{
    public static ConsolePickupPointDto ToDto(PickupLocation p) =>
        new(p.Code, p.Name, p.Address, p.Schedule, p.Instructions, p.MapUrl, p.IsActive);
}
