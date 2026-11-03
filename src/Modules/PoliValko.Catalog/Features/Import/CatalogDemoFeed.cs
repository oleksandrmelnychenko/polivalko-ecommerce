using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Persistence;

namespace PoliValko.Catalog.Features.Import;

internal sealed class CatalogDemoFeed : ICatalogDemoFeed
{
    public Task<IReadOnlyList<NavkoloProductRecord>> LoadNavkoloRecordsAsync(CancellationToken ct) =>
        CatalogDemoData.LoadNavkoloRecordsAsync(ct);
}
