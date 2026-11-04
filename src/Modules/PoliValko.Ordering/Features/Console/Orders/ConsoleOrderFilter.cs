using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Orders;

internal sealed record ConsoleOrderFilter(
    string? Q,
    OrderStatus? Status,
    PaymentStatus? PaymentStatus,
    DeliveryMethod? Delivery,
    DateOnly? From,
    DateOnly? To,
    string Sort)
{
    public static ConsoleOrderFilter Parse(
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

        var parsedSort = ConsoleOrderSorts.Newest;
        if (!string.IsNullOrWhiteSpace(sort))
        {
            var known = ConsoleOrderSorts.All.FirstOrDefault(s => string.Equals(s, sort.Trim(), StringComparison.OrdinalIgnoreCase));
            if (known is null)
            {
                errors["sort"] = [$"Допустимі значення: {string.Join(", ", ConsoleOrderSorts.All)}."];
            }
            else
            {
                parsedSort = known;
            }
        }

        return new ConsoleOrderFilter(q, parsedStatus, parsedPayment, parsedDelivery, from, to, parsedSort);
    }

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
        ConsoleOrderSorts.Oldest => orders.OrderBy(o => o.CreatedAt).ThenBy(o => o.Id),
        ConsoleOrderSorts.TotalDesc => orders.OrderByDescending(o => o.Total).ThenByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id),
        ConsoleOrderSorts.TotalAsc => orders.OrderBy(o => o.Total).ThenByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id),
        _ => orders.OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id),
    };
}
