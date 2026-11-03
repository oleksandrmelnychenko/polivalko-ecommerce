namespace PoliValko.Infrastructure.Sync;

public sealed class SyncState
{
    public required string Job { get; init; }

    public DateTimeOffset? LastAttemptAt { get; set; }

    public DateTimeOffset? LastSuccessAt { get; set; }

    public string? LastError { get; set; }

    public int ConsecutiveFailures { get; set; }

    public DateTimeOffset? RunRequestedAt { get; set; }

    public DateTimeOffset? AlertedAt { get; set; }
}
