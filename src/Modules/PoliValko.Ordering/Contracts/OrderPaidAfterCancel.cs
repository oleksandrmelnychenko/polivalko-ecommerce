using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Ordering.Contracts;

public sealed record OrderPaidAfterCancel(Guid OrderId) : IOutboxMessage
{
    public static string Type => "ordering.paid-after-cancel";
}
