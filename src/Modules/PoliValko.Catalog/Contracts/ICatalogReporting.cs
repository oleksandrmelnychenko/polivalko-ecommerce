namespace PoliValko.Catalog.Contracts;

public interface ICatalogReporting
{
    Task<IReadOnlyList<ProductCard>> GetProductCardsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);

    Task<IReadOnlyList<LowStockProduct>> GetLowStockAsync(int take, CancellationToken ct);

    Task<IReadOnlyList<ProductSearchHit>> SearchProductsAsync(string term, int limit, CancellationToken ct);
}
