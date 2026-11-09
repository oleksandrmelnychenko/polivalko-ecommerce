namespace PoliValko.Ordering.Contracts;

/// <summary>Why the open invoices of an order are withdrawn. Persisted in outbox messages: append only.</summary>
public enum PaymentCancellationReason
{
    OrderCancelled,

    /// <summary>Another invoice of the order was paid, so the rest would take the money twice.</summary>
    OrderPaid,
}
