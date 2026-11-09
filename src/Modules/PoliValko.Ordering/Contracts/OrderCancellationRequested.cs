using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Ordering.Contracts;

public sealed record OrderCancellationRequested(Guid OrderId) : IOutboxMessage
{
    public static string Type => "ordering.cancellation-requested.v1";
}
