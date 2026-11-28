namespace PoliValko.Ordering.Contracts;

public interface IExternalOrderSyncStatus
{
    Task<bool> IsEnabledAsync(CancellationToken ct);
}
