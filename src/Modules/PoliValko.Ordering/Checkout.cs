using System.Globalization;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using PoliValko.Catalog;
using PoliValko.Delivery;
using PoliValko.Ordering.Api;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering;

internal sealed record PricedLine(
    Guid ProductId,
    ProductPricing? Product,
    int Quantity,
    int AvailableQuantity,
    decimal UnitPrice,
    decimal LineTotal,
    string? Issue);

/// <summary>Перерахунок кошика на сервері: ціни й наявність незалежно від клієнта (розділ 5 ТЗ).</summary>
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
}

internal sealed record ValidatedOrder(
    string Name,
    string Phone,
    string? Email,
    DeliveryMethod Delivery,
    Settlement? Settlement,
    Warehouse? Warehouse,
    string? Address,
    PaymentMethod Payment,
    decimal ExpectedTotal,
    string? Comment);

internal static class OrderValidator
{
    public static async Task<(Dictionary<string, string[]> Errors, ValidatedOrder? Order)> ValidateAsync(
        CreateOrderRequest request,
        IDeliveryDirectory directory,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        CheckoutCalculator.ValidateItems(request.Items, errors);

        if (!decimal.TryParse(request.ExpectedTotal, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var expectedTotal))
        {
            errors["expectedTotal"] = ["Передайте суму, яку бачив покупець, у форматі \"1234.00\"."];
        }

        var name = request.Customer?.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length is < 2 or > 100)
        {
            errors["customer.name"] = ["Вкажіть ім'я та прізвище (від 2 до 100 символів)."];
        }

        if (!PhoneNumber.TryNormalizeUa(request.Customer?.Phone, out var phone))
        {
            errors["customer.phone"] = ["Вкажіть український номер телефону, наприклад +380 67 123 45 67."];
        }

        var email = string.IsNullOrWhiteSpace(request.Customer?.Email) ? null : request.Customer.Email.Trim();
        if (email is not null && (email.Length > 200 || !MailAddress.TryCreate(email, out _)))
        {
            errors["customer.email"] = ["Перевірте email або залиште поле порожнім."];
        }

        var delivery = DeliveryCodes.Parse(request.Delivery?.Method);
        Settlement? settlement = null;
        Warehouse? warehouse = null;
        string? address = null;
        if (delivery is null)
        {
            errors["delivery.method"] = ["Оберіть спосіб отримання."];
        }
        else if (delivery is DeliveryMethod.NovaPoshta or DeliveryMethod.NovaPoshtaCourier)
        {
            settlement = string.IsNullOrWhiteSpace(request.Delivery!.SettlementRef)
                ? null
                : await directory.FindSettlementAsync(request.Delivery.SettlementRef, ct);
            if (settlement is null)
            {
                errors["delivery.settlementRef"] = ["Оберіть населений пункт зі списку."];
            }
            else if (delivery == DeliveryMethod.NovaPoshtaCourier)
            {
                address = ValidateAddress(request.Delivery.Address, errors);
            }
            else
            {
                warehouse = string.IsNullOrWhiteSpace(request.Delivery.WarehouseRef)
                    ? null
                    : await directory.FindWarehouseAsync(request.Delivery.WarehouseRef, ct);
                if (warehouse is null || warehouse.SettlementRef != settlement.Ref)
                {
                    errors["delivery.warehouseRef"] = ["Оберіть відділення або поштомат зі списку."];
                }
            }
        }

        var payment = PaymentCodes.Parse(request.Payment?.Method);
        if (payment is null)
        {
            errors["payment.method"] = ["Оберіть спосіб оплати."];
        }
        else if (delivery is { } d && !CheckoutCalculator.IsAllowed(d, payment.Value))
        {
            errors["payment.method"] = ["Цей спосіб оплати недоступний для обраного способу отримання."];
        }

        var comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        if (comment is { Length: > 1000 })
        {
            errors["comment"] = ["Коментар має бути не довшим за 1000 символів."];
        }

        if (!request.AcceptOffer)
        {
            errors["acceptOffer"] = ["Підтвердіть згоду з умовами публічної оферти."];
        }

        if (errors.Count > 0)
        {
            return (errors, null);
        }

        return (errors, new ValidatedOrder(name!, phone, email, delivery!.Value, settlement, warehouse, address, payment!.Value, decimal.Round(expectedTotal, 2), comment));
    }

    /// <summary>"вул. Соборна, буд. 12, кв. 5" або null з помилками в <paramref name="errors"/>.</summary>
    private static string? ValidateAddress(DeliveryAddressRequest? address, Dictionary<string, string[]> errors)
    {
        var street = address?.Street?.Trim();
        var house = address?.House?.Trim();
        var apartment = address?.Apartment?.Trim();
        if (string.IsNullOrEmpty(street) || street.Length is < 2 or > 150)
        {
            errors["delivery.address.street"] = ["Вкажіть вулицю."];
        }

        if (string.IsNullOrEmpty(house) || house.Length > 20)
        {
            errors["delivery.address.house"] = ["Вкажіть номер будинку."];
        }

        if (apartment is { Length: > 20 })
        {
            errors["delivery.address.apartment"] = ["Номер квартири — до 20 символів."];
        }

        if (string.IsNullOrEmpty(street) || string.IsNullOrEmpty(house) || errors.Keys.Any(k => k.StartsWith("delivery.address", StringComparison.Ordinal)))
        {
            return null;
        }

        return string.IsNullOrEmpty(apartment) ? $"{street}, буд. {house}" : $"{street}, буд. {house}, кв. {apartment}";
    }
}

/// <summary>Токен доступу гостя до свого замовлення. У БД зберігається лише SHA-256.</summary>
internal static class OrderTokens
{
    public static (string Token, string Hash) Create()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        return (token, Hash(token));
    }

    public static bool Matches(string? token, string hash) =>
        !string.IsNullOrEmpty(token)
        && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(token)), Encoding.ASCII.GetBytes(hash));

    private static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

/// <summary>
/// Переходи статусів для менеджера. Оплачене замовлення скасовується лише після повного
/// повернення коштів: гроші покупця не «зависають» у скасованому замовленні.
/// </summary>
internal static class OrderTransitions
{
    public static IReadOnlyList<OrderStatus> Allowed(Order order) => order.Status switch
    {
        OrderStatus.New or OrderStatus.AwaitingConfirmation => [OrderStatus.Confirmed, OrderStatus.Cancelled],
        OrderStatus.Confirmed when order.PaymentMethod == PaymentMethod.Card => [OrderStatus.AwaitingPayment, OrderStatus.Cancelled],
        OrderStatus.Confirmed => [Fulfilment(order), OrderStatus.Cancelled],
        OrderStatus.AwaitingPayment => [OrderStatus.Cancelled],
        OrderStatus.Paid => CanCancel(order) ? [Fulfilment(order), OrderStatus.Cancelled] : [Fulfilment(order)],
        OrderStatus.Shipped or OrderStatus.ReadyForPickup => CanCancel(order) ? [OrderStatus.Completed, OrderStatus.Cancelled] : [OrderStatus.Completed],
        _ => [],
    };

    /// <summary>Скасувати можна, якщо онлайн-оплати не було або її повністю повернуто.</summary>
    public static bool CanCancel(Order order) => order.PaymentStatus is not (PaymentStatus.Succeeded or PaymentStatus.PartiallyRefunded);

    private static OrderStatus Fulfilment(Order order) =>
        order.DeliveryMethod == DeliveryMethod.Pickup ? OrderStatus.ReadyForPickup : OrderStatus.Shipped;
}
