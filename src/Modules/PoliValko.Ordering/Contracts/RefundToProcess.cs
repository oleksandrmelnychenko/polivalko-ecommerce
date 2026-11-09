namespace PoliValko.Ordering.Contracts;

/// <param name="SubmittedAs">Reference the refund was sent to the provider with; null until the first submission.</param>
public sealed record RefundToProcess(
    Guid OrderId,
    string OrderNumber,
    Guid RefundId,
    RefundStatus Status,
    decimal Amount,
    IReadOnlyList<RefundToProcessLine> Lines,
    string? SubmittedAs);
