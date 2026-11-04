namespace PoliValko.Customers.Domain;

public sealed class CustomerAddress
{
    public const int MaxPerCustomer = 10;

    public Guid Id { get; init; }

    public Guid CustomerId { get; init; }

    public string? Label { get; set; }

    public required string DeliveryMethod { get; set; }

    public required string SettlementRef { get; set; }

    public required string SettlementName { get; set; }

    public string? WarehouseRef { get; set; }

    public string? WarehouseName { get; set; }

    public string? Street { get; set; }

    public string? House { get; set; }

    public string? Apartment { get; set; }

    public bool IsDefault { get; set; }

    public DateTimeOffset CreatedAt { get; init; }
}
