using PoliValko.Catalog.Contracts;
using PoliValko.Navkolo.Configuration;

namespace PoliValko.Navkolo.Integrations.NavkoloApi;

internal sealed class StubNavkoloClient(Microsoft.Extensions.Options.IOptionsMonitor<NavkoloOptions> options, ICatalogDemoFeed demoFeed) : INavkoloClient
{
    public async Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct)
    {
        ThrowIfOutage();
        return await demoFeed.LoadNavkoloRecordsAsync(ct);
    }

    public async Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct)
    {
        ThrowIfOutage();
        return (await demoFeed.LoadNavkoloRecordsAsync(ct))
            .Select(r => new PriceStockRecord(r.NavkoloId!, r.Price!.Value, r.OldPrice, r.Stock ?? 0))
            .ToList();
    }

    public Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct)
    {
        ThrowIfOutage();
        return Task.FromResult($"NK-{order.Number}");
    }

    private void ThrowIfOutage()
    {
        if (options.CurrentValue.Stub.SimulateOutage)
        {
            throw new NavkoloUnavailableException("Navkolo недоступна (імітація збою в заглушці).");
        }
    }
}
