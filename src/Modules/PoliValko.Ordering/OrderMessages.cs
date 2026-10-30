using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Notifications;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering;

public sealed record OrderPlaced(Guid OrderId) : IOutboxMessage
{
    public static string Type => "ordering.order-placed";
}

public sealed record PaymentSucceeded(Guid OrderId) : IOutboxMessage
{
    public static string Type => "ordering.payment-succeeded";
}

/// <summary>Передати нове замовлення в Navkolo (розділ 7 ТЗ). Обробник — у модулі Navkolo.</summary>
public sealed record OrderExportRequested(Guid OrderId) : IOutboxMessage
{
    public static string Type => "ordering.export-requested";
}

/// <summary>Подія, після якої за правилами продавця може знадобитися фіскальний чек.</summary>
public enum FiscalTrigger
{
    /// <summary>Підтверджена онлайн-оплата.</summary>
    Payment = 0,

    /// <summary>Замовлення виконане: покупець заплатив під час отримання.</summary>
    Completion = 1,

    /// <summary>Повернення коштів (чек повернення).</summary>
    Refund = 2,
}

/// <summary>Запит на чек ПРРО. Модуль фіскалізації вирішує за погодженою матрицею, чи потрібен чек.</summary>
public sealed record FiscalReceiptRequested(Guid OrderId, FiscalTrigger Trigger, Guid? RefundId = null) : IOutboxMessage
{
    public static string Type => "ordering.fiscal-receipt-requested";
}

/// <summary>Повернення коштів на картку через платіжного провайдера. Обробник — у модулі платежів.</summary>
public sealed record RefundRequested(Guid OrderId, Guid RefundId) : IOutboxMessage
{
    public static string Type => "ordering.refund-requested";
}

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
        var body = $"{order.Items.Count} поз. на {Money(order.Total)}\n{delivery}\nОплата: {payment}\n{order.CustomerName}, {order.CustomerPhone}{attention}";

        await notifier.NotifyAsync(new ManagerNotification($"Нове замовлення {order.Number}", body), cancellationToken);
    }

    internal static string Money(decimal amount) => amount.ToString("N2", CultureInfo.GetCultureInfo("uk-UA")) + " грн";
}

internal sealed class NotifyManagerOnPaymentSucceeded(PoliValkoDbContext db, IManagerNotifier notifier) : IOutboxHandler<PaymentSucceeded>
{
    public async Task HandleAsync(PaymentSucceeded message, CancellationToken cancellationToken)
    {
        var order = await db.Set<Order>().AsNoTracking().SingleAsync(o => o.Id == message.OrderId, cancellationToken);
        await notifier.NotifyAsync(
            new ManagerNotification($"Оплачено замовлення {order.Number}", $"Сума: {NotifyManagerOnOrderPlaced.Money(order.Total)}"),
            cancellationToken);
    }
}
