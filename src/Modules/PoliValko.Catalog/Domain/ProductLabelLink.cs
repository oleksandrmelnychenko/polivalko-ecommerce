namespace PoliValko.Catalog.Domain;

public sealed class ProductLabelLink
{
    public Guid ProductId { get; init; }

    public Guid LabelId { get; init; }
}
