namespace PoliValko.Infrastructure.Outbox;

public sealed class OutboxMessage
{
    public Guid Id { get; init; }

    public required string Type { get; init; }

    public required string Payload { get; init; }

    public DateTimeOffset OccurredAt { get; init; }

    public OutboxStatus Status { get; set; }

    public int Attempts { get; set; }

    public DateTimeOffset NextAttemptAt { get; set; }

    public DateTimeOffset? LockedUntil { get; set; }

    public DateTimeOffset? ProcessedAt { get; set; }

    public string? LastError { get; set; }
}
