namespace PoliValko.Delivery.Domain;

internal sealed class PickupLocation
{
    public required string Code { get; init; }

    public required string Name { get; set; }

    public required string Address { get; set; }

    public required string Schedule { get; set; }

    public required string Instructions { get; set; }

    public string? MapUrl { get; set; }

    public bool IsActive { get; set; }
}
