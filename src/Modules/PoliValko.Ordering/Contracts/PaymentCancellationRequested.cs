using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Ordering.Contracts;

/// <summary>
/// Invoices the customer has not paid yet must stop accepting money: the order was cancelled or is already paid.
/// <see cref="Reason"/> was added later; messages written without it read as <see cref="PaymentCancellationReason.OrderCancelled"/>.
/// </summary>
public sealed record PaymentCancellationRequested(Guid OrderId, PaymentCancellationReason Reason = PaymentCancellationReason.OrderCancelled) : IOutboxMessage
{
    public static string Type => "ordering.payment-cancellation-requested.v1";
}
