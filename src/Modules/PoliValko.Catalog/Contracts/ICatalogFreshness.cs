namespace PoliValko.Catalog.Contracts;

public interface ICatalogFreshness
{
    Task<bool> IsFreshAsync(CancellationToken ct);
}
