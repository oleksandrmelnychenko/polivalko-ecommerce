namespace PoliValko.Catalog.Domain;

public sealed class ProductImage
{
    public Guid Id { get; init; }

    public Guid ProductId { get; init; }

    public required string Url { get; set; }

    public required string Alt { get; set; }

    public int SortOrder { get; set; }

    public string? Credit { get; set; }
}
