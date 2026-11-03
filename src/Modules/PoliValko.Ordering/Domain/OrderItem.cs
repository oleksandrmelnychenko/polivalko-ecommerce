namespace PoliValko.Ordering.Domain;

public sealed class OrderItem
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public Guid ProductId { get; init; }

    public required string Sku { get; init; }

    public required string Name { get; init; }

    public required string Slug { get; init; }

    public string? ImageUrl { get; init; }

    public decimal UnitPrice { get; init; }

    public int Quantity { get; init; }

    public decimal LineTotal { get; init; }
}
