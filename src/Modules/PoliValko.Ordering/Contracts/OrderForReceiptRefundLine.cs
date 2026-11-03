namespace PoliValko.Ordering.Contracts;

public sealed record OrderForReceiptRefundLine(Guid OrderItemId, int Quantity);
