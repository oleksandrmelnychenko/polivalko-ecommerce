namespace PoliValko.Payments.Domain;

public sealed class Payment
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public required string OrderNumber { get; init; }

    public required string Provider { get; init; }

    public string? ProviderPaymentId { get; set; }

    public decimal Amount { get; init; }

    public PaymentAttemptStatus Status { get; set; }

    public string? PageUrl { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; init; }

    public DateTimeOffset? ProviderModifiedAt { get; set; }

    public string? FailureReason { get; set; }

    public bool IsActive => Status is PaymentAttemptStatus.Created or PaymentAttemptStatus.Processing;
}
