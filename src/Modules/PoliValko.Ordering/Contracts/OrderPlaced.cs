using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Ordering.Contracts;

public sealed record OrderPlaced(Guid OrderId) : IOutboxMessage
{
    public static string Type => "ordering.order-placed";
}
