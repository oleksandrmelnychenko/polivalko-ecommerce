using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Navkolo.Integrations.NavkoloApi;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Navkolo.Features.OrderExport;

internal sealed class CancelOrderInNavkolo(PoliValkoDbContext db, IOrderExportSource orders,
    INavkoloClient client, ICatalogReservations reservations, NavkoloOrderGate gate, TimeProvider time) : IOutboxHandler<OrderCancellationRequested>
{
    public Task HandleAsync(OrderCancellationRequested message, CancellationToken ct) => gate.RunAsync(message.OrderId, async () =>
    {
        var order = await orders.GetAsync(message.OrderId, ct);
        if (order.Status != OrderStatus.Cancelled || order.CancellationSynchronizedAt is not null) return;
        if (order.ExportAttemptedAt is not null || order.NavkoloOrderRef is not null)
            await client.CancelOrderAsync(order.Id, order.NavkoloOrderRef, ct);

        // Only after ERP acknowledgement; retrying remote cancellation cannot release inventory twice.
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await reservations.ReleaseAsync(order.Id, ct);
        await orders.MarkCancellationSynchronizedAsync(order.Id, time.GetUtcNow(), ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }, ct);
}
