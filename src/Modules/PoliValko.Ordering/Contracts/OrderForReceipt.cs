namespace PoliValko.Ordering.Contracts;

public sealed record OrderForReceipt(
    Guid Id,
    string Number,
    PaymentMethod PaymentMethod,
    IReadOnlyList<OrderForReceiptItem> Items,
    IReadOnlyList<OrderForReceiptRefund> Refunds);
