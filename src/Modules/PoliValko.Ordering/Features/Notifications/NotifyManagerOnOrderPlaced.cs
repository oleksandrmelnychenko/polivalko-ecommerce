using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Notifications.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Notifications;

internal sealed class NotifyManagerOnOrderPlaced(PoliValkoDbContext db, IManagerNotifier notifier) : IOutboxHandler<OrderPlaced>
{
    public async Task HandleAsync(OrderPlaced message, CancellationToken cancellationToken)
    {
        var order = await db.Set<Order>().AsNoTracking().Include(o => o.Items)
            .SingleAsync(o => o.Id == message.OrderId, cancellationToken);

        var delivery = order.DeliveryMethod switch
        {
            DeliveryMethod.Pickup => "Самовивіз у Бучі",
            DeliveryMethod.NovaPoshtaCourier => $"Кур'єр Нової пошти: {order.SettlementName}, {order.DeliveryAddress}",
            _ => $"Нова пошта: {order.SettlementName}, {order.WarehouseName}",
        };
        var payment = order.PaymentMethod switch
        {
            PaymentMethod.Card => "онлайн карткою",
            PaymentMethod.CashOnDelivery => "післяплата",
            _ => "під час самовивозу",
        };
        var attention = order.Status == OrderStatus.AwaitingConfirmation ? "\nПотрібне підтвердження ціни й наявності." : string.Empty;
        var body = $"{order.Items.Count} поз. на {OrderMoney.Money(order.Total)}\n{delivery}\nОплата: {payment}\n{order.CustomerName}, {order.CustomerPhone}{attention}";

        await notifier.NotifyAsync(new ManagerNotification($"Нове замовлення {order.Number}", body, ManagerEvent.NewOrder), cancellationToken);
    }
}
