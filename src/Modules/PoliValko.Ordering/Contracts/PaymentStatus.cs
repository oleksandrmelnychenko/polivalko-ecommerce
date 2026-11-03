namespace PoliValko.Ordering.Contracts;

public enum PaymentStatus
{
    NotRequired,
    Pending,
    Succeeded,
    Failed,
    PartiallyRefunded,
    Refunded,
}
