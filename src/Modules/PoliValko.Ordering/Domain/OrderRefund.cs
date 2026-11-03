using PoliValko.Ordering.Contracts;

namespace PoliValko.Ordering.Domain;

public sealed class OrderRefund
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public RefundMethod Method { get; init; }

    public RefundStatus Status { get; set; }

    public decimal Amount { get; init; }

    public required string Reason { get; init; }

    public required string RequestedBy { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? CompletedAt { get; set; }

    public string? ProviderRef { get; set; }

    public string? Error { get; set; }

    public List<OrderRefundLine> Lines { get; init; } = [];
}
