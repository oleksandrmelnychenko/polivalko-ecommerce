using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Notifications.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Notifications;

internal sealed class NotifyManagerOnOrderPaidAfterCancel(PoliValkoDbContext db, IManagerNotifier notifier) : IOutboxHandler<OrderPaidAfterCancel>
{
    public async Task HandleAsync(OrderPaidAfterCancel message, CancellationToken cancellationToken)
    {
        var order = await db.Set<Order>().AsNoTracking().SingleAsync(o => o.Id == message.OrderId, cancellationToken);
        await notifier.NotifyAsync(
            new ManagerNotification(
                $"Оплачено скасоване замовлення {order.Number}",
                $"Покупець оплатив замовлення після скасування. Оформіть повернення коштів у консолі.\nСума: {OrderMoney.Money(order.Total)}",
                ManagerEvent.PaymentAfterCancel),
            cancellationToken);
    }
}
