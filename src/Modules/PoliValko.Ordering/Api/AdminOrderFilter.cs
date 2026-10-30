using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Api;

/// <summary>Порядок списку замовлень в адмінці (параметр <c>sort</c>).</summary>
public static class AdminOrderSorts
{
    public const string Newest = "newest";
    public const string Oldest = "oldest";
    public const string TotalDesc = "totalDesc";
    public const string TotalAsc = "totalAsc";

    public static readonly IReadOnlyList<string> All = [Newest, Oldest, TotalDesc, TotalAsc];
}

/// <summary>
/// Фільтри списку замовлень адмінки. Ті самі правила застосовують список, лічильники за статусами
/// й вивантаження в CSV, тож цифри на вкладках завжди збігаються з тим, що видно в таблиці.
/// Дати <c>from</c>/<c>to</c> — київські, включно.
/// </summary>
internal sealed record AdminOrderFilter(
    string? Q,
    OrderStatus? Status,
    PaymentStatus? PaymentStatus,
    DeliveryMethod? Delivery,
    DateOnly? From,
    DateOnly? To,
    string Sort)
{
    /// <summary>Розбирає параметри запиту; помилки — у форматі ValidationProblem за назвами параметрів.</summary>
    public static AdminOrderFilter Parse(
        string? q,
        string? status,
        string? paymentStatus,
        string? delivery,
        DateOnly? from,
        DateOnly? to,
        string? sort,
        Dictionary<string, string[]> errors)
    {
        if (!QueryEnum.TryParse<OrderStatus>(status, out var parsedStatus))
        {
            errors["status"] = [$"Допустимі значення: {QueryEnum.Allowed<OrderStatus>()}."];
        }

        if (!QueryEnum.TryParse<PaymentStatus>(paymentStatus, out var parsedPayment))
        {
            errors["paymentStatus"] = [$"Допустимі значення: {QueryEnum.Allowed<PaymentStatus>()}."];
        }

        DeliveryMethod? parsedDelivery = null;
        if (!string.IsNullOrWhiteSpace(delivery))
        {
            parsedDelivery = DeliveryCodes.Parse(delivery.Trim().ToLowerInvariant());
            if (parsedDelivery is null)
            {
                errors["delivery"] = [$"Допустимі значення: {DeliveryCodes.NovaPoshta}, {DeliveryCodes.NovaPoshtaCourier}, {DeliveryCodes.Pickup}."];
            }
        }

        if (from is { } start && to is { } end && start > end)
        {
            errors["from"] = ["Дата «з» не може бути пізнішою за дату «по»."];
        }

        var parsedSort = AdminOrderSorts.Newest;
        if (!string.IsNullOrWhiteSpace(sort))
        {
            var known = AdminOrderSorts.All.FirstOrDefault(s => string.Equals(s, sort.Trim(), StringComparison.OrdinalIgnoreCase));
            if (known is null)
            {
                errors["sort"] = [$"Допустимі значення: {string.Join(", ", AdminOrderSorts.All)}."];
            }
            else
            {
                parsedSort = known;
            }
        }

        return new AdminOrderFilter(q, parsedStatus, parsedPayment, parsedDelivery, from, to, parsedSort);
    }

    /// <summary>Пошук і фільтри. <paramref name="byStatus"/> = false для лічильників за статусами.</summary>
    public IQueryable<Order> Apply(IQueryable<Order> orders, bool byStatus = true)
    {
        orders = orders.MatchingNumberOrPhone(Q);

        if (byStatus && Status is { } status)
        {
            orders = orders.Where(o => o.Status == status);
        }

        if (PaymentStatus is { } payment)
        {
            orders = orders.Where(o => o.PaymentStatus == payment);
        }

        if (Delivery is { } delivery)
        {
            orders = orders.Where(o => o.DeliveryMethod == delivery);
        }

        if (From is { } from)
        {
            var start = KyivTime.StartOfDay(from);
            orders = orders.Where(o => o.CreatedAt >= start);
        }

        if (To is { } to)
        {
            var end = KyivTime.StartOfDay(to.AddDays(1));
            orders = orders.Where(o => o.CreatedAt < end);
        }

        return orders;
    }

    public IQueryable<Order> ApplySort(IQueryable<Order> orders) => Sort switch
    {
        AdminOrderSorts.Oldest => orders.OrderBy(o => o.CreatedAt).ThenBy(o => o.Id),
        AdminOrderSorts.TotalDesc => orders.OrderByDescending(o => o.Total).ThenByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id),
        AdminOrderSorts.TotalAsc => orders.OrderBy(o => o.Total).ThenByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id),
        _ => orders.OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id),
    };
}

/// <summary>Пошук замовлень і покупців для адмінки. Покупці без облікових записів: покупець — це телефон.</summary>
public static class OrderSearch
{
    /// <summary>Номер замовлення (частина, без урахування регістру) або від трьох цифр телефону.</summary>
    public static IQueryable<Order> MatchingNumberOrPhone(this IQueryable<Order> orders, string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return orders;
        }

        var term = q.Trim().ToUpperInvariant();
        var digits = SqlLike.Digits(term);
        return orders.Where(o => o.Number.Contains(term) || (digits.Length >= 3 && o.CustomerPhone.Contains(digits)));
    }

    /// <summary>
    /// Усі замовлення тих покупців (за телефоном), у яких хоч одне замовлення збігається з пошуком
    /// за іменем, email або від трьох цифр телефону. Так агрегати по покупцю рахуються з усіх його замовлень.
    /// </summary>
    public static IQueryable<Order> OfCustomersMatching(this IQueryable<Order> orders, string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return orders;
        }

        var term = q.Trim();
        var pattern = SqlLike.Contains(term);
        var digits = SqlLike.Digits(term);
        var phones = orders
            .Where(o => EF.Functions.ILike(o.CustomerName, pattern, SqlLike.Escape)
                || (o.CustomerEmail != null && EF.Functions.ILike(o.CustomerEmail, pattern, SqlLike.Escape))
                || (digits.Length >= 3 && o.CustomerPhone.Contains(digits)))
            .Select(o => o.CustomerPhone);
        return orders.Where(o => phones.Contains(o.CustomerPhone));
    }
}
