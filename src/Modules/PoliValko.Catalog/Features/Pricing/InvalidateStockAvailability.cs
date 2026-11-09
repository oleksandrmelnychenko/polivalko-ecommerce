using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Pricing;

internal sealed class InvalidateStockAvailability(IStorefrontCache cache) : IOutboxHandler<StockAvailabilityChanged>
{
    public Task HandleAsync(StockAvailabilityChanged message, CancellationToken cancellationToken) =>
        cache.InvalidateAsync([StorefrontTags.Products, StorefrontTags.Catalog, StorefrontTags.Collections], cancellationToken);
}
