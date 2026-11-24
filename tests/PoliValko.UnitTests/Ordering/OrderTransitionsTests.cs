using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.UnitTests.Ordering;

public sealed class OrderTransitionsTests
{
    private static readonly DateTimeOffset At = new(2026, 11, 24, 10, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(OrderStatus.Paid)]
    [InlineData(OrderStatus.Shipped)]
    [InlineData(OrderStatus.ReadyForPickup)]
    public void A_fully_refunded_order_can_only_be_cancelled(OrderStatus status)
    {
        var order = Paid(status);
        order.ApplySucceededRefund(Refund(order.Total), At);

        // Completing it would write off goods whose money went back to the buyer.
        OrderTransitions.Allowed(order).ShouldBe([OrderStatus.Cancelled]);
    }

    [Fact]
    public void A_partly_refunded_order_still_goes_on_to_completion()
    {
        var order = Paid(OrderStatus.Shipped);
        order.ApplySucceededRefund(Refund(30m), At);

        OrderTransitions.Allowed(order).ShouldBe([OrderStatus.Completed]);
    }

    private static Order Paid(OrderStatus status)
    {
        var order = new Order
        {
            Number = "PV-1", AccessTokenHash = "-", IdempotencyKey = "-", CustomerName = "Олена", CustomerPhone = "+380670000000",
            SellerName = "-", Total = 100m, PaymentMethod = PaymentMethod.Card, DeliveryMethod = DeliveryMethod.NovaPoshta,
        };
        order.InitPaymentStatus();
        order.MarkPaid(At, "test");
        order.Status = status;
        return order;
    }

    private static OrderRefund Refund(decimal amount) =>
        new() { Amount = amount, Method = RefundMethod.Provider, Reason = "Повернення", RequestedBy = "test" };
}
