using Microsoft.Extensions.Configuration;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Cancellation;

internal sealed class ConfigurationOrderSyncStatus(IConfiguration configuration) : IExternalOrderSyncStatus
{
    public Task<bool> IsEnabledAsync(CancellationToken ct) =>
        Task.FromResult(
            configuration.GetValue("Navkolo:OrderSyncEnabled", true)
            && !string.Equals(configuration["Navkolo:Mode"], "Disabled", StringComparison.OrdinalIgnoreCase));
}

internal static class OrderCancellationEffects
{
    public static async Task ApplyAsync(Order order, IOutbox outbox, ICatalogReservations reservations, bool externalOrderSyncEnabled, CancellationToken ct)
    {
        if (externalOrderSyncEnabled)
        {
            outbox.Enqueue(new OrderCancellationRequested(order.Id));
        }

        if (order.PaymentMethod == PaymentMethod.Card)
        {
            outbox.Enqueue(new PaymentCancellationRequested(order.Id));
        }

        if (!externalOrderSyncEnabled || (order.NavkoloExportAttemptedAt is null && order.NavkoloOrderRef is null))
        {
            await reservations.ReleaseAsync(order.Id, ct);
        }
    }
}
