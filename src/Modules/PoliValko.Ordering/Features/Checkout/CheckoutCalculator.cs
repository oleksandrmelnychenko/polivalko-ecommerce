using PoliValko.Catalog.Contracts;
using PoliValko.Delivery.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Checkout;

internal sealed class CheckoutCalculator(ICatalogPricing pricing)
{
    public const int MaxLines = 50;
    public const int MaxQuantity = 999;

    public static IReadOnlyList<DeliveryMethodOptionDto> DeliveryOptions(DeliveryAvailability availability, bool card)
    {
        var options = new List<DeliveryMethodOptionDto>(3);
        if (availability.NovaPoshta && Payments(availability, card, "Післяплата у відділенні") is { Count: > 0 } branch)
        {
            options.Add(new(DeliveryCodes.NovaPoshta, "Нова пошта: відділення або поштомат", branch));
        }

        if (availability.Courier && Payments(availability, card, "Післяплата кур'єру") is { Count: > 0 } courier)
        {
            options.Add(new(
                DeliveryCodes.NovaPoshtaCourier,
                "Кур'єр Нової пошти",
                courier,
                availability.CourierArea,
                availability.CourierPriceNote));
        }

        if (availability.Pickup is not null)
        {
            options.Add(new(
                DeliveryCodes.Pickup,
                "Самовивіз",
                card
                    ? [new(PaymentCodes.Card, "Онлайн карткою"), new(PaymentCodes.PayOnPickup, "Під час самовивозу")]
                    : [new(PaymentCodes.PayOnPickup, "Під час самовивозу")]));
        }

        return options;
    }

    public async Task<(IReadOnlyList<PricedLine> Lines, decimal Subtotal)> PriceAsync(IReadOnlyList<CartLineRequest> items, CancellationToken ct)
    {
        var products = await pricing.GetAsync(items.Select(i => i.ProductId).ToList(), ct);
        return Price(items, products);
    }

    internal static (IReadOnlyList<PricedLine> Lines, decimal Subtotal) Price(
        IReadOnlyList<CartLineRequest> items, IReadOnlyDictionary<Guid, ProductPricing> products)
    {
        var lines = new List<PricedLine>(items.Count);

        foreach (var item in items)
        {
            products.TryGetValue(item.ProductId, out var product);
            var available = product is { IsVisible: true, Price: > 0 } ? (int)Math.Max(Math.Floor(product.Stock), 0) : 0;
            var issue = available <= 0
                ? QuoteIssues.Unavailable
                : available < item.Quantity ? QuoteIssues.InsufficientStock : null;
            var unitPrice = product?.Price ?? 0m;
            var lineTotal = issue == QuoteIssues.Unavailable ? 0m : unitPrice * item.Quantity;
            lines.Add(new PricedLine(item.ProductId, product, item.Quantity, available, unitPrice, lineTotal, issue));
        }

        return (lines, lines.Sum(l => l.LineTotal));
    }

    public static bool IsOffered(DeliveryAvailability availability, bool card, DeliveryMethod delivery) =>
        DeliveryOptions(availability, card).Any(o => o.Code == DeliveryCodes.From(delivery));

    public static bool IsAllowed(DeliveryAvailability availability, bool card, DeliveryMethod delivery, PaymentMethod payment) =>
        DeliveryOptions(availability, card)
            .Where(o => o.Code == DeliveryCodes.From(delivery))
            .SelectMany(o => o.PaymentMethods)
            .Any(p => p.Code == PaymentCodes.From(payment));

    public static void ValidateItems(IReadOnlyList<CartLineRequest>? items, Dictionary<string, string[]> errors)
    {
        if (items is null || items.Count == 0)
        {
            errors["items"] = ["Кошик порожній."];
        }
        else if (items.Count > MaxLines)
        {
            errors["items"] = [$"Не більше {MaxLines} позицій в одному замовленні."];
        }
        else if (items.Any(i => i is null || i.ProductId == Guid.Empty || i.Quantity is < 1 or > MaxQuantity))
        {
            errors["items"] = [$"Кількість має бути від 1 до {MaxQuantity}."];
        }
        else if (items.Select(i => i.ProductId).Distinct().Count() != items.Count)
        {
            errors["items"] = ["Кожен товар має бути в кошику один раз."];
        }
    }

    public static QuoteLineDto ToDto(PricedLine line) => new(
        line.ProductId,
        line.Product?.Slug ?? string.Empty,
        line.Product?.Sku ?? string.Empty,
        line.Product?.Name ?? "Товар недоступний",
        line.Product?.ImageUrl,
        MoneyDto.Hryvnia(line.UnitPrice),
        line.Quantity,
        line.AvailableQuantity,
        MoneyDto.Hryvnia(line.LineTotal),
        line.Issue);

    private static List<PaymentMethodOptionDto> Payments(DeliveryAvailability availability, bool card, string cashOnDelivery)
    {
        var methods = new List<PaymentMethodOptionDto>(2);
        if (card)
        {
            methods.Add(new(PaymentCodes.Card, "Онлайн карткою"));
        }

        if (availability.CashOnDelivery)
        {
            methods.Add(new(PaymentCodes.CashOnDelivery, cashOnDelivery));
        }

        return methods;
    }

    internal sealed record PricedLine(
        Guid ProductId,
        ProductPricing? Product,
        int Quantity,
        int AvailableQuantity,
        decimal UnitPrice,
        decimal LineTotal,
        string? Issue);
}
