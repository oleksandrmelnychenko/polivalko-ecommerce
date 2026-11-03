namespace PoliValko.Payments.Domain;

public sealed class SandboxInvoice
{
    public required string Id { get; init; }

    public required string OrderNumber { get; init; }

    public decimal Amount { get; init; }

    public decimal RefundedAmount { get; set; }

    public required string Status { get; set; }

    public required string RedirectUrl { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ModifiedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; init; }
}
