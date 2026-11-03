namespace PoliValko.Infrastructure.Audit;

public sealed class AuditEntry
{
    public Guid Id { get; init; }

    public DateTimeOffset At { get; init; }

    public required string Actor { get; init; }

    public required string Action { get; init; }

    public required string EntityType { get; init; }

    public string? EntityId { get; init; }

    public string? Details { get; init; }
}
