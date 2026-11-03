namespace PoliValko.Infrastructure.Sync;

public interface ISyncJournal
{
    Task<SyncRun> RunAsync(string job, string startedBy, Func<CancellationToken, Task<SyncResult>> body, CancellationToken ct);

    Task RequestRunAsync(string job, CancellationToken ct);
}
