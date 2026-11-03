namespace PoliValko.Ordering.Domain;

public sealed class OrderRefundLine
{
    public Guid Id { get; init; }

    public Guid RefundId { get; init; }

    public Guid OrderItemId { get; init; }

    public int Quantity { get; init; }

    public decimal Amount { get; init; }
}
