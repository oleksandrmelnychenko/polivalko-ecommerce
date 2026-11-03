using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Ordering.Contracts;

public sealed record RefundRequested(Guid OrderId, Guid RefundId) : IOutboxMessage
{
    public static string Type => "ordering.refund-requested";
}
