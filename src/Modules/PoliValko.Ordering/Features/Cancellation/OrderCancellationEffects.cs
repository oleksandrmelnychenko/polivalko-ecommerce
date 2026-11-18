using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Cancellation;

internal static class OrderCancellationEffects
{
    public static async Task ApplyAsync(Order order, IOutbox outbox, ICatalogReservations reservations, CancellationToken ct)
    {
        outbox.Enqueue(new OrderCancellationRequested(order.Id));
        if (order.PaymentMethod == PaymentMethod.Card)
        {
            outbox.Enqueue(new PaymentCancellationRequested(order.Id));
        }

        if (order.NavkoloExportAttemptedAt is null && order.NavkoloOrderRef is null)
        {
            await reservations.ReleaseAsync(order.Id, ct);
        }
    }
}
