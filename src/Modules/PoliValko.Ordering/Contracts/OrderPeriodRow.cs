namespace PoliValko.Ordering.Contracts;

public sealed record OrderPeriodRow(DateTimeOffset CreatedAt, OrderStatus Status, DeliveryMethod DeliveryMethod, string Phone, decimal Total, decimal RefundedAmount);
