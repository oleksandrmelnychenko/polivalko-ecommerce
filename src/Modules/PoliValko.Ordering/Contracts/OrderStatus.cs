namespace PoliValko.Ordering.Contracts;

public enum OrderStatus
{
    New,

    AwaitingConfirmation,
    Confirmed,
    AwaitingPayment,
    Paid,
    Shipped,
    ReadyForPickup,
    Completed,
    Cancelled,
}
