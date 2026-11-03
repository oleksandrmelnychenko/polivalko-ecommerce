using PoliValko.Ordering.Contracts;

namespace PoliValko.Ordering.Domain;

internal static class OrderTransitions
{
    public static IReadOnlyList<OrderStatus> Allowed(Order order) => order.Status switch
    {
        OrderStatus.New or OrderStatus.AwaitingConfirmation => [OrderStatus.Confirmed, OrderStatus.Cancelled],
        OrderStatus.Confirmed when order.PaymentMethod == PaymentMethod.Card => [OrderStatus.AwaitingPayment, OrderStatus.Cancelled],
        OrderStatus.Confirmed => [Fulfilment(order), OrderStatus.Cancelled],
        OrderStatus.AwaitingPayment => [OrderStatus.Cancelled],
        OrderStatus.Paid => CanCancel(order) ? [Fulfilment(order), OrderStatus.Cancelled] : [Fulfilment(order)],
        OrderStatus.Shipped or OrderStatus.ReadyForPickup => CanCancel(order) ? [OrderStatus.Completed, OrderStatus.Cancelled] : [OrderStatus.Completed],
        _ => [],
    };

    public static bool CanCancel(Order order) => order.PaymentStatus is not (PaymentStatus.Succeeded or PaymentStatus.PartiallyRefunded);

    private static OrderStatus Fulfilment(Order order) =>
        order.DeliveryMethod == DeliveryMethod.Pickup ? OrderStatus.ReadyForPickup : OrderStatus.Shipped;
}
