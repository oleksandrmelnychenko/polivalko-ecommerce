namespace PoliValko.Infrastructure.Sync;

public sealed record SyncResult(string Summary, IReadOnlyList<SyncError> Errors)
{
    public static SyncResult Ok(string summary) => new(summary, []);
}
