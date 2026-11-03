namespace PoliValko.Catalog.Domain;

public sealed class ProductPrice
{
    public Guid ProductId { get; init; }

    public decimal Amount { get; set; }

    public decimal? OldAmount { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
