namespace PoliValko.Ordering.Contracts;

public sealed record RefundToProcess(
    Guid OrderId,
    string OrderNumber,
    Guid RefundId,
    RefundStatus Status,
    decimal Amount,
    IReadOnlyList<RefundToProcessLine> Lines);
