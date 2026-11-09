namespace PoliValko.Catalog.Domain;

public sealed class ProductStock
{
    public Guid ProductId { get; init; }

    public decimal Quantity { get; set; }

    public decimal ReservedQuantity { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
