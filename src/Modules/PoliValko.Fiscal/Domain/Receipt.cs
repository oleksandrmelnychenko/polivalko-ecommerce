namespace PoliValko.Fiscal.Domain;

public sealed class Receipt
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public required string OrderNumber { get; init; }

    public ReceiptKind Kind { get; init; }

    public Guid? RefundId { get; init; }

    public decimal Amount { get; init; }

    public required string PaymentType { get; init; }

    public ReceiptStatus Status { get; set; }

    public required string Provider { get; init; }

    public string? ProviderReceiptId { get; set; }

    public string? FiscalCode { get; set; }

    public string? Url { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? IssuedAt { get; set; }

    public string? Error { get; set; }
}
