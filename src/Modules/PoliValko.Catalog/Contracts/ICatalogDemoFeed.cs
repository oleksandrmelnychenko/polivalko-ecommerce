namespace PoliValko.Catalog.Contracts;

public interface ICatalogDemoFeed
{
    Task<IReadOnlyList<NavkoloProductRecord>> LoadNavkoloRecordsAsync(CancellationToken ct);
}
