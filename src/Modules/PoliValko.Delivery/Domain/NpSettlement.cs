namespace PoliValko.Delivery.Domain;

internal sealed class NpSettlement
{
    public required string Ref { get; init; }

    public required string Name { get; set; }

    public required string Area { get; set; }

    public required string SearchName { get; set; }

    public int ActiveWarehouseCount { get; set; }

    public bool IsActive { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }
}
