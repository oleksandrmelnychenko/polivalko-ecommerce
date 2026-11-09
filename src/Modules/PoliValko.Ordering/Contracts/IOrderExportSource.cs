namespace PoliValko.Ordering.Contracts;

public interface IOrderExportSource
{
    Task<OrderForExport> GetAsync(Guid orderId, CancellationToken ct);

    Task<bool> BeginExportAsync(Guid orderId, DateTimeOffset at, CancellationToken ct);
    Task MarkCancellationSynchronizedAsync(Guid orderId, DateTimeOffset at, CancellationToken ct);

    Task MarkExportedAsync(Guid orderId, string reference, DateTimeOffset at, CancellationToken ct);
}
