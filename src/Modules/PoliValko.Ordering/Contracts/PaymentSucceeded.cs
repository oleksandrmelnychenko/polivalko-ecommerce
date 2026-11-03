using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Ordering.Contracts;

public sealed record PaymentSucceeded(Guid OrderId) : IOutboxMessage
{
    public static string Type => "ordering.payment-succeeded";
}
