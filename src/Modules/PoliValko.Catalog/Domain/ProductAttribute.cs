namespace PoliValko.Catalog.Domain;

public sealed class ProductAttribute
{
    public Guid Id { get; init; }

    public Guid ProductId { get; init; }

    public required string Name { get; set; }

    public required string Value { get; set; }

    public int SortOrder { get; set; }
}
