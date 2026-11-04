namespace PoliValko.Catalog.Domain;

public sealed class Favorite
{
    public const int MaxPerCustomer = 200;

    public Guid CustomerId { get; init; }

    public Guid ProductId { get; init; }

    public DateTimeOffset AddedAt { get; init; }
}
