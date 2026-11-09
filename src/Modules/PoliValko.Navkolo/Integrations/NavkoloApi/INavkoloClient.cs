using PoliValko.Catalog.Contracts;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Navkolo.Integrations.NavkoloApi;

public interface INavkoloClient
{
    Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct);

    Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct);

    Task CancelOrderAsync(Guid orderId, string? reference, CancellationToken ct);

    Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct);
    Task<IReadOnlyList<ExternalOrderState>> GetOrderStatesAsync(CancellationToken ct) => Task.FromResult<IReadOnlyList<ExternalOrderState>>([]);
}
