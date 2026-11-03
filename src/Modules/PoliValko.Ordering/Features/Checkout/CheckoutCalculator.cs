using PoliValko.Catalog.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Checkout;

internal sealed class CheckoutCalculator(ICatalogPricing pricing)
{
    public const int MaxLines = 50;
    public const int MaxQuantity = 999;

    public static readonly IReadOnlyList<DeliveryMethodOptionDto> DeliveryOptions =
    [
        new(DeliveryCodes.NovaPoshta, "Нова пошта: відділення або поштомат",
        [
            new(PaymentCodes.Card, "Онлайн карткою"),
            new(PaymentCodes.CashOnDelivery, "Післяплата у відділенні"),
        ]),
        new(DeliveryCodes.NovaPoshtaCourier, "Кур'єр Нової пошти",
        [
            new(PaymentCodes.Card, "Онлайн карткою"),
            new(PaymentCodes.CashOnDelivery, "Післяплата кур'єру"),
        ]),
        new(DeliveryCodes.Pickup, "Самовивіз у Бучі",
        [
            new(PaymentCodes.Card, "Онлайн карткою"),
            new(PaymentCodes.PayOnPickup, "Під час самовивозу"),
        ]),
    ];

    public async Task<(IReadOnlyList<PricedLine> Lines, decimal Subtotal)> PriceAsync(IReadOnlyList<CartLineRequest> items, CancellationToken ct)
    {
        var products = await pricing.GetAsync(items.Select(i => i.ProductId).ToList(), ct);
        var lines = new List<PricedLine>(items.Count);

        foreach (var item in items)
        {
            products.TryGetValue(item.ProductId, out var product);
            var available = product is { IsVisible: true } ? (int)Math.Max(Math.Floor(product.Stock), 0) : 0;
            var issue = available <= 0
                ? QuoteIssues.Unavailable
                : available < item.Quantity ? QuoteIssues.InsufficientStock : null;
            var unitPrice = product?.Price ?? 0m;
            var lineTotal = issue == QuoteIssues.Unavailable ? 0m : unitPrice * item.Quantity;
            lines.Add(new PricedLine(item.ProductId, product, item.Quantity, available, unitPrice, lineTotal, issue));
        }

        return (lines, lines.Sum(l => l.LineTotal));
    }

    public static bool IsAllowed(DeliveryMethod delivery, PaymentMethod payment) => delivery switch
    {
        DeliveryMethod.NovaPoshta or DeliveryMethod.NovaPoshtaCourier => payment is PaymentMethod.Card or PaymentMethod.CashOnDelivery,
        _ => payment is PaymentMethod.Card or PaymentMethod.PayOnPickup,
    };

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
        else if (items.Any(i => i.Quantity is < 1 or > MaxQuantity))
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

    internal sealed record PricedLine(
        Guid ProductId,
        ProductPricing? Product,
        int Quantity,
        int AvailableQuantity,
        decimal UnitPrice,
        decimal LineTotal,
        string? Issue);
}
