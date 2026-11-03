using PoliValko.Catalog.Contracts;

namespace PoliValko.Navkolo.Integrations.NavkoloApi;

public interface INavkoloClient
{
    Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct);

    Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct);

    Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct);
}
