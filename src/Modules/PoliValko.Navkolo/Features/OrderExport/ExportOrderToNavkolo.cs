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
    IOptions<NavkoloOptions> options,
    TimeProvider time) : IOutboxHandler<OrderExportRequested>
{
    public async Task HandleAsync(OrderExportRequested message, CancellationToken cancellationToken)
    {
        if (!options.Value.IsEnabled)
        {
            return;
        }

        var order = await orders.GetAsync(message.OrderId, cancellationToken);
        if (order.NavkoloOrderRef is not null)
        {
            return;
        }

        var delivery = order.DeliveryMethod switch
        {
            DeliveryMethod.Pickup => $"Самовивіз: {order.PickupAddress}",
            DeliveryMethod.NovaPoshtaCourier => $"Кур'єр НП: {order.SettlementName}, {order.DeliveryAddress}",
            _ => $"НП: {order.SettlementName}, {order.WarehouseName}",
        };
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
                order.Lines.Select(i => new NavkoloOrderLine(i.Sku, i.Name, i.Quantity, i.UnitPrice)).ToList()),
            cancellationToken);

        await orders.MarkExportedAsync(order.Id, reference, time.GetUtcNow(), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
    }
}
