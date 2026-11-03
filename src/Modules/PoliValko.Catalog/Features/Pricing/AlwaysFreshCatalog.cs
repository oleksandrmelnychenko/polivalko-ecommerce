using PoliValko.Catalog.Contracts;

namespace PoliValko.Catalog.Features.Pricing;

internal sealed class AlwaysFreshCatalog : ICatalogFreshness
{
    public Task<bool> IsFreshAsync(CancellationToken ct) => Task.FromResult(true);
}
