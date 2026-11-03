namespace PoliValko.Delivery.Contracts;

public sealed record Warehouse(string Ref, string SettlementRef, int Number, string Name, string Address, WarehouseType Type);
