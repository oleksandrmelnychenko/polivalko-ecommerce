using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Catalog.Contracts;

public sealed record StockAvailabilityChanged : IOutboxMessage
{
    public static string Type => "catalog.stock-availability-changed.v1";
}
