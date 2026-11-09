using System.Globalization;
using System.Text;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class OrderCsv
{
    public const int MaxRows = 5000;
    public const string ContentType = "text/csv; charset=utf-8";

    private static readonly string[] Header =
        ["Номер", "Дата", "Покупець", "Телефон", "Email", "Статус", "Оплата", "Спосіб оплати", "Отримання", "Позицій", "Сума", "Повернено"];

    internal sealed record Row(
        string Number,
        DateTimeOffset CreatedAt,
        string CustomerName,
        string CustomerPhone,
        string? CustomerEmail,
        OrderStatus Status,
        PaymentStatus PaymentStatus,
        PaymentMethod PaymentMethod,
        DeliveryMethod DeliveryMethod,
        int ItemsCount,
        decimal Total,
        decimal RefundedAmount);

    public static string FileName(DateOnly kyivToday) => $"polivalko-orders-{kyivToday:yyyyMMdd}.csv";

    public static byte[] Build(IEnumerable<Row> rows)
    {
        var csv = new StringBuilder();
        AppendLine(csv, Header);
        foreach (var r in rows)
        {
            AppendLine(csv,
            [
                r.Number,
                KyivTime.ToLocal(r.CreatedAt).ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture),
                Text(r.CustomerName),
                r.CustomerPhone,
                Text(r.CustomerEmail),
                StatusLabel(r.Status),
                PaymentStatusLabel(r.PaymentStatus),
                PaymentMethodLabel(r.PaymentMethod),
                DeliveryLabel(r.DeliveryMethod),
                r.ItemsCount.ToString(CultureInfo.InvariantCulture),
                Amount(r.Total),
                Amount(r.RefundedAmount),
            ]);
        }

        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(csv.ToString())];
    }

    public static string StatusLabel(OrderStatus status) => status switch
    {
        OrderStatus.New => "Нове",
        OrderStatus.AwaitingConfirmation => "Чекає підтвердження",
        OrderStatus.Confirmed => "Підтверджене",
        OrderStatus.AwaitingPayment => "Чекає оплати",
        OrderStatus.Paid => "Оплачене",
        OrderStatus.Shipped => "Відправлене",
        OrderStatus.ReadyForPickup => "Готове до видачі",
        OrderStatus.Completed => "Виконане",
        OrderStatus.Cancelled => "Скасоване",
        _ => status.ToString(),
    };

    public static string PaymentStatusLabel(PaymentStatus status) => status switch
    {
        PaymentStatus.NotRequired => "Оплата під час отримання",
        PaymentStatus.Pending => "Чекає оплати",
        PaymentStatus.Succeeded => "Оплачено",
        PaymentStatus.Failed => "Оплата не пройшла",
        PaymentStatus.PartiallyRefunded => "Частково повернено",
        PaymentStatus.Refunded => "Кошти повернено",
        _ => status.ToString(),
    };

    public static string PaymentMethodLabel(PaymentMethod method) => method switch
    {
        PaymentMethod.Card => "Карткою онлайн",
        PaymentMethod.CashOnDelivery => "Післяплата",
        PaymentMethod.PayOnPickup => "У магазині",
        _ => method.ToString(),
    };

    public static string DeliveryLabel(DeliveryMethod method) => method switch
    {
        DeliveryMethod.NovaPoshta => "Нова пошта",
        DeliveryMethod.NovaPoshtaCourier => "Кур'єр Нової пошти",
        DeliveryMethod.Pickup => "Самовивіз",
        _ => method.ToString(),
    };

    private static string Amount(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero).ToString("0.00", CultureInfo.InvariantCulture).Replace('.', ',');

    private static string Text(string? value) =>
        value is { Length: > 0 } && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r' ? $"'{value}" : value ?? string.Empty;

    private static void AppendLine(StringBuilder csv, IReadOnlyList<string> fields)
    {
        for (var i = 0; i < fields.Count; i++)
        {
            if (i > 0)
            {
                csv.Append(';');
            }

            var field = fields[i];
            if (field.AsSpan().IndexOfAny(";\"\r\n") >= 0)
            {
                csv.Append('"').Append(field.Replace("\"", "\"\"")).Append('"');
            }
            else
            {
                csv.Append(field);
            }
        }

        csv.Append("\r\n");
    }
}
