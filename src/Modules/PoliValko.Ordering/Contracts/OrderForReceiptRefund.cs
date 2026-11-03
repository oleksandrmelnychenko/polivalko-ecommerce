namespace PoliValko.Ordering.Contracts;

public sealed record OrderForReceiptRefund(Guid Id, IReadOnlyList<OrderForReceiptRefundLine> Lines);
