namespace PoliValko.Payments.Domain;

public sealed class PaymentEvent
{
    public Guid Id { get; init; }

    public required string Provider { get; init; }

    public required string EventKey { get; init; }

    public Guid? PaymentId { get; init; }

    public required string Source { get; init; }

    public required string State { get; init; }

    public DateTimeOffset ReceivedAt { get; init; }

    public string? Payload { get; init; }
}
