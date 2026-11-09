namespace PoliValko.Infrastructure.Idempotency;

public sealed class IdempotencyRecord
{
    public string? SubjectHash { get; init; }
    public required string Scope { get; init; }

    public required string Key { get; init; }

    public required string RequestHash { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? CompletedAt { get; set; }

    public int? StatusCode { get; set; }

    public string? ResponseBody { get; set; }

    public string? ResponseLocation { get; set; }
}
