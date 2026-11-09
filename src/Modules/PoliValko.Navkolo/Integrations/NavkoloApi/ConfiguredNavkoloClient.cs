using Microsoft.Extensions.Options;
using PoliValko.Catalog.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Features.Settings;

namespace PoliValko.Navkolo.Integrations.NavkoloApi;

internal sealed class NavkoloClientFactory(IHttpClientFactory http, DnTradeRequestGate gate)
{
    public HttpNavkoloClient Create(NavkoloOptions options) => new(http.CreateClient("DNTrade"), Options.Create(options), gate);
}

internal sealed class ConfiguredNavkoloClient(NavkoloSettings settings, NavkoloClientFactory factory, StubNavkoloClient stub) : INavkoloClient
{
    private async Task<INavkoloClient> ClientAsync(CancellationToken ct)
    {
        var options = await settings.LoadAsync(ct);
        return options.Mode switch
        {
            NavkoloModes.DnTrade => factory.Create(options),
            NavkoloModes.Stub => stub,
            _ => throw new NavkoloUnavailableException("Синхронізацію Навколо вимкнено."),
        };
    }
    public async Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct) => await (await ClientAsync(ct)).GetCatalogAsync(ct);
    public async Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct) => await (await ClientAsync(ct)).GetPriceStockAsync(ct);
    public async Task CancelOrderAsync(Guid orderId, string? reference, CancellationToken ct) => await (await ClientAsync(ct)).CancelOrderAsync(orderId, reference, ct);
    public async Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct) => await (await ClientAsync(ct)).SendOrderAsync(order, ct);
    public async Task<IReadOnlyList<ExternalOrderState>> GetOrderStatesAsync(CancellationToken ct) => await (await ClientAsync(ct)).GetOrderStatesAsync(ct);
}
