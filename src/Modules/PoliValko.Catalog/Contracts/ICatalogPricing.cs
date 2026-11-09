namespace PoliValko.Catalog.Contracts;

public interface ICatalogPricing
{
    Task<IReadOnlyDictionary<Guid, ProductPricing>> GetAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct);
    Task<IReadOnlyDictionary<Guid, string>> NavkoloIdsAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct);
}
