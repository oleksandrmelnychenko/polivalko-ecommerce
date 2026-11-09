using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Integrations.NavkoloApi;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Navkolo.Features.OrderExport;

internal sealed class ExportOrderToNavkolo(
    PoliValkoDbContext db,
    IOrderExportSource orders,
    INavkoloClient client,
    Contracts.INavkoloSettings settings,
    TimeProvider time, NavkoloOrderGate gate) : IOutboxHandler<OrderExportRequested>
{
    public Task HandleAsync(OrderExportRequested message, CancellationToken cancellationToken) =>
        gate.RunAsync(message.OrderId, () => ExportAsync(message, cancellationToken), cancellationToken);

    private async Task ExportAsync(OrderExportRequested message, CancellationToken cancellationToken)
    {
        if (await settings.GetModeAsync(cancellationToken) == NavkoloModes.Disabled)
        {
            return;
        }

        var order = await orders.GetAsync(message.OrderId, cancellationToken);
        if (order.NavkoloOrderRef is not null || order.Status == OrderStatus.Cancelled)
        {
            return;
        }

        var delivery = order.DeliveryMethod switch
        {
            DeliveryMethod.Pickup => $"Самовивіз: {order.PickupAddress}",
            DeliveryMethod.NovaPoshtaCourier => $"Кур'єр НП: {order.SettlementName}, {order.DeliveryAddress}",
            _ => $"НП: {order.SettlementName}, {order.WarehouseName}",
        };
        if (!await orders.BeginExportAsync(order.Id, time.GetUtcNow(), cancellationToken)) return;
        var reference = await client.SendOrderAsync(
            new NavkoloOrder(
                order.Number,
                order.CreatedAt,
                order.CustomerName,
                order.CustomerPhone,
                delivery,
                order.PaymentMethod.ToString(),
                order.Total,
                order.Comment,
                order.Lines.Select(i => new NavkoloOrderLine(i.Sku, i.Name, i.Quantity, i.UnitPrice, i.NavkoloId)).ToList(), order.Id),
            cancellationToken);

        await orders.MarkExportedAsync(order.Id, reference, time.GetUtcNow(), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
    }
}
