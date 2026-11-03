using PoliValko.Delivery.Contracts;

namespace PoliValko.Delivery.Domain;

internal sealed class NpWarehouse
{
    public required string Ref { get; init; }

    public required string SettlementRef { get; set; }

    public int Number { get; set; }

    public required string Name { get; set; }

    public required string Address { get; set; }

    public WarehouseType Type { get; set; }

    public required string SearchText { get; set; }

    public bool IsActive { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }
}
