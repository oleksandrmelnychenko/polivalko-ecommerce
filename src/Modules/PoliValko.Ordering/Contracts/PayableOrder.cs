namespace PoliValko.Ordering.Contracts;

public sealed record PayableOrder(
    Guid Id,
    string Number,
    decimal Total,
    PaymentMethod PaymentMethod,
    bool CanPay,
    IReadOnlyList<PayableOrderLine> Items);
