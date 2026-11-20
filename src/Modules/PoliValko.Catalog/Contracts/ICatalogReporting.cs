namespace PoliValko.Catalog.Contracts;

public interface ICatalogReporting
{
    Task<IReadOnlyList<ProductCard>> GetProductCardsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);

    Task<IReadOnlyList<LowStockProduct>> GetLowStockAsync(int take, CancellationToken ct);

    Task<IReadOnlyList<ProductSearchHit>> SearchProductsAsync(string term, int limit, CancellationToken ct);

    Task<IReadOnlyList<AnalyticsCatalogProduct>> GetAnalyticsProductsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);

    Task<AnalyticsCatalogInventory> GetAnalyticsInventoryAsync(CancellationToken ct);

    Task<IReadOnlyList<AnalyticsCatalogMatch>> FindAnalyticsProductsAsync(IReadOnlyCollection<string> externalIds,
        IReadOnlyCollection<string> skus, CancellationToken ct);
}

public sealed record AnalyticsCatalogProduct(Guid Id, string Name, string Sku, decimal Stock);

public sealed record AnalyticsCatalogInventory(int HealthyProducts, int LowStockProducts, int OutOfStockProducts, decimal LowStockThreshold);

public sealed record AnalyticsCatalogMatch(Guid Id, string ExternalId, string Name, string Sku);
