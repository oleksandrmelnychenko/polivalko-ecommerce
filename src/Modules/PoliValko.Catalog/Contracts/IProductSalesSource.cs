namespace PoliValko.Catalog.Contracts;

public sealed record ProductSalesCount(Guid ProductId, int Orders, int Quantity);

public interface IProductSalesSource
{
    Task<IReadOnlyList<ProductSalesCount>> TopSinceAsync(DateTimeOffset from, int take, CancellationToken ct);
}
