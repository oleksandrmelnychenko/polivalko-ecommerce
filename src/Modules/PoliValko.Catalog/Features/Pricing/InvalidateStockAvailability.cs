using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Pricing;

internal sealed class InvalidateStockAvailability(IStorefrontCache cache) : IOutboxHandler<StockAvailabilityChanged>
{
    // An order changes only what can be bought: the storefront refreshes that data in the background (the "stock"
    // tag is not expired at once), and the category tree, brand pages and the rest of the catalog stay. Checkout
    // checks the stock itself, so a listing a moment behind cannot sell what is gone. Other changes, such as a new
    // price or a stock sync, still drop the whole catalog at once.
    public Task HandleAsync(StockAvailabilityChanged message, CancellationToken cancellationToken) =>
        cache.InvalidateAsync(
            message.OrdersOnly
                ? [StorefrontTags.Stock]
                : [StorefrontTags.Products, StorefrontTags.Catalog, StorefrontTags.Collections],
            cancellationToken);
}
