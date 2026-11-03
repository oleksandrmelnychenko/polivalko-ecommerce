namespace PoliValko.Delivery.Contracts;

public sealed record PickupPoint(string Code, string Name, string Address, string Schedule, string Instructions, string? MapUrl = null);
