using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Notifications.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Notifications;

internal sealed class NotifyManagerOnPaymentSucceeded(PoliValkoDbContext db, IManagerNotifier notifier) : IOutboxHandler<PaymentSucceeded>
{
    public async Task HandleAsync(PaymentSucceeded message, CancellationToken cancellationToken)
    {
        var order = await db.Set<Order>().AsNoTracking().SingleAsync(o => o.Id == message.OrderId, cancellationToken);
        await notifier.NotifyAsync(
            new ManagerNotification($"Оплачено замовлення {order.Number}", $"Сума: {OrderMoney.Money(order.Total)}", ManagerEvent.OrderPaid),
            cancellationToken);
    }
}
