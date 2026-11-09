namespace PoliValko.Ordering.Contracts;

public sealed record SubmittedRefund(Guid OrderId, string OrderNumber, Guid RefundId);
