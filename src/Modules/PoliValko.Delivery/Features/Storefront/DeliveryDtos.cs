using PoliValko.Delivery.Contracts;

namespace PoliValko.Delivery.Features.Storefront;

public sealed record SettlementDto(string Ref, string Name, string Area);

public sealed record WarehouseDto(string Ref, int Number, string Name, string Address, WarehouseType Type);

public sealed record PickupPointDto(string Code, string Name, string Address, string Schedule, string Instructions, string? MapUrl);
