using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Catalog.Contracts;

public sealed record StockAvailabilityChanged : IOutboxMessage
{
    public static string Type => "catalog.stock-availability-changed.v1";

    /// <summary>
    /// The change comes from an order reserving, releasing or shipping goods: only what can be bought changed, not a
    /// price, a name or a section. Orders arrive all day, so the storefront refreshes such data in the background
    /// instead of rebuilding every catalog page at once. A message saved before this field existed reads as false.
    /// </summary>
    public bool OrdersOnly { get; init; }
}
