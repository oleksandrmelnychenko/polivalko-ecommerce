namespace PoliValko.Infrastructure.Sync;

public sealed class SyncRun
{
    public Guid Id { get; init; }

    public required string Job { get; init; }

    public DateTimeOffset StartedAt { get; init; }

    public DateTimeOffset? FinishedAt { get; set; }

    public SyncRunStatus Status { get; set; }

    public required string StartedBy { get; init; }

    public string? Summary { get; set; }

    public int ErrorCount { get; set; }

    public string? Errors { get; set; }
}
