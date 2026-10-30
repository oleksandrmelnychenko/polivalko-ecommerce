using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Catalog;
using PoliValko.Delivery;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Api;

public static class CheckoutEndpoints
{
    public const string CustomerActor = "Покупець";
    public const string PaymentActor = "Платіжна система";

    public static IEndpointRouteBuilder MapOrderingEndpoints(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Checkout");

        group.MapPost("/checkout/quote", QuoteAsync)
            .WithName("QuoteCheckout")
            .WithSummary("Перерахунок кошика на сервері: ціни, наявність, способи отримання й оплати");

        group.MapPost("/orders", CreateOrderAsync)
            .RequireIdempotency<CreateOrderRequest>()
            .WithName("CreateOrder")
            .WithSummary("Гостьове замовлення. Сервер повторно перевіряє ціни й наявність.")
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        group.MapGet("/orders/{number}", GetOrderAsync)
            .WithName("GetOrder")
            .WithSummary("Статус замовлення для покупця (за токеном зі сторінки результату)")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/seller", (IOptions<SellerOptions> seller) =>
                TypedResults.Ok(new SellerDto(seller.Value.Name, seller.Value.TaxId, seller.Value.Address)))
            .WithName("GetSeller")
            .WithSummary("Продавець, з яким покупець укладає договір (для оферти й сторінки замовлення)");

        return api;
    }

    private static async Task<Results<Ok<QuoteDto>, ValidationProblem>> QuoteAsync(
        QuoteRequest request,
        CheckoutCalculator calculator,
        ICatalogFreshness freshness,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        CheckoutCalculator.ValidateItems(request.Items, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var (lines, subtotal) = await calculator.PriceAsync(request.Items!, ct);
        return TypedResults.Ok(new QuoteDto(
            lines.Select(CheckoutCalculator.ToDto).ToList(),
            MoneyDto.Hryvnia(subtotal),
            MoneyDto.Hryvnia(subtotal),
            "Доставка оплачується за тарифами перевізника",
            CheckoutCalculator.DeliveryOptions,
            await freshness.IsFreshAsync(ct)));
    }

    private static async Task<Results<Created<OrderCreatedDto>, ValidationProblem, ProblemHttpResult>> CreateOrderAsync(
        CreateOrderRequest request,
        HttpRequest http,
        PoliValkoDbContext db,
        CheckoutCalculator calculator,
        IDeliveryDirectory directory,
        ICatalogFreshness freshness,
        IOptions<SellerOptions> seller,
        IOutbox outbox,
        TimeProvider time,
        CancellationToken ct)
    {
        var (errors, valid) = await OrderValidator.ValidateAsync(request, directory, ct);
        if (valid is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var (lines, subtotal) = await calculator.PriceAsync(request.Items!, ct);
        var issues = lines.Where(l => l.Issue is not null).ToList();
        if (issues.Count > 0)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "checkout.insufficient_stock",
                "Частини товарів немає в потрібній кількості",
                "Змініть кількість або приберіть товари, яких немає в наявності.",
                [new("items", issues.Select(l => new StockIssueDto(l.ProductId, l.Quantity, l.AvailableQuantity, l.Issue!)).ToList())]);
        }

        if (subtotal != valid.ExpectedTotal)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "checkout.price_changed",
                "Ціни змінилися",
                "Перевірте нову суму замовлення перед підтвердженням.",
                [new("total", MoneyDto.Hryvnia(subtotal))]);
        }

        // Якщо ціни й залишки не підтверджені ERP, приймаємо заявку без онлайн-оплати (розділ 7 ТЗ).
        var fresh = await freshness.IsFreshAsync(ct);
        var isCard = valid.Payment == PaymentMethod.Card;
        var status = !fresh ? OrderStatus.AwaitingConfirmation : isCard ? OrderStatus.AwaitingPayment : OrderStatus.New;
        var now = time.GetUtcNow();
        var number = await db.Database
            .SqlQuery<long>($"SELECT nextval('ordering.order_number_seq') AS \"Value\"")
            .SingleAsync(ct);
        var (token, tokenHash) = OrderTokens.Create();
        var orderId = Guid.CreateVersion7(now);
        var pickup = valid.Delivery == DeliveryMethod.Pickup ? await directory.GetPickupAsync(ct) : null;

        var order = new Order
        {
            Id = orderId,
            Number = $"PV-{number}",
            AccessTokenHash = tokenHash,
            IdempotencyKey = http.Headers[IdempotencyHeaders.Key].ToString(),
            Status = status,
            PaymentMethod = valid.Payment,
            DeliveryMethod = valid.Delivery,
            CustomerName = valid.Name,
            CustomerPhone = valid.Phone,
            CustomerEmail = valid.Email,
            SettlementRef = valid.Settlement?.Ref,
            SettlementName = valid.Settlement?.Name,
            WarehouseRef = valid.Warehouse?.Ref,
            WarehouseName = valid.Warehouse is { } w ? $"{w.Name}, {w.Address}" : null,
            DeliveryAddress = valid.Address,
            PickupAddress = pickup is null ? null : $"{pickup.Name}, {pickup.Address}",
            Comment = valid.Comment,
            SellerName = seller.Value.Name,
            SellerTaxId = seller.Value.TaxId,
            Subtotal = subtotal,
            Total = subtotal,
            CreatedAt = now,
            Items = lines.Select(l => new OrderItem
            {
                Id = Guid.CreateVersion7(now),
                OrderId = orderId,
                ProductId = l.ProductId,
                Sku = l.Product!.Sku,
                Name = l.Product.Name,
                Slug = l.Product.Slug,
                ImageUrl = l.Product.ImageUrl,
                UnitPrice = l.UnitPrice,
                Quantity = l.Quantity,
                LineTotal = l.LineTotal,
            }).ToList(),
        };
        order.InitPaymentStatus();
        order.History.Add(new OrderStatusChange
        {
            Id = Guid.CreateVersion7(now),
            OrderId = orderId,
            From = null,
            To = status,
            At = now,
            By = CustomerActor,
        });

        db.Add(order);
        outbox.Enqueue(new OrderPlaced(order.Id));
        outbox.Enqueue(new OrderExportRequested(order.Id));
        await db.SaveChangesAsync(ct);

        return TypedResults.Created(
            $"/api/v1/orders/{order.Number}",
            new OrderCreatedDto(order.Number, token, order.Status, order.PaymentStatus, MoneyDto.Hryvnia(order.Total), CanPay(order)));
    }

    private static async Task<Results<Ok<OrderDto>, ProblemHttpResult>> GetOrderAsync(
        string number,
        string? token,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var order = await LoadAsync(db, number, tracking: false, ct);
        if (order is null || !OrderTokens.Matches(token, order.AccessTokenHash))
        {
            return OrderNotFound();
        }

        return TypedResults.Ok(ToDto(order));
    }

    public static Task<Order?> LoadAsync(PoliValkoDbContext db, string number, bool tracking, CancellationToken ct)
    {
        var query = db.Set<Order>()
            .Include(o => o.Items)
            .Include(o => o.History)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery();
        return (tracking ? query : query.AsNoTracking()).FirstOrDefaultAsync(o => o.Number == number, ct);
    }

    /// <summary>Чи може покупець відкрити оплату: замовлення підтверджене й чекає на картку.</summary>
    public static bool CanPay(Order order) =>
        order.PaymentMethod == PaymentMethod.Card
        && order.Status == OrderStatus.AwaitingPayment
        && order.PaymentStatus is PaymentStatus.Pending or PaymentStatus.Failed;

    /// <summary>Перевіряє токен гостя до замовлення (для модулів платежів і фіскалізації).</summary>
    public static bool TokenMatches(Order order, string? token) => OrderTokens.Matches(token, order.AccessTokenHash);

    internal static OrderItemDto ToDto(OrderItem i) => new(
        i.ProductId,
        i.Slug,
        i.Sku,
        i.Name,
        i.ImageUrl,
        MoneyDto.Hryvnia(i.UnitPrice),
        i.Quantity,
        MoneyDto.Hryvnia(i.LineTotal));

    private static OrderDto ToDto(Order order) => new(
        order.Number,
        order.CreatedAt,
        order.Status,
        PaymentCodes.From(order.PaymentMethod),
        order.PaymentStatus,
        DeliveryCodes.From(order.DeliveryMethod),
        new OrderDeliveryDto(order.SettlementName, order.WarehouseName, order.PickupAddress, order.DeliveryAddress),
        new OrderCustomerDto(order.CustomerName, MaskPhone(order.CustomerPhone)),
        order.Items.Select(ToDto).ToList(),
        MoneyDto.Hryvnia(order.Subtotal),
        MoneyDto.Hryvnia(order.Total),
        order.History.OrderBy(h => h.At).Select(h => new OrderHistoryEntryDto(h.To, h.At)).ToList(),
        CanPay(order),
        MoneyDto.Hryvnia(order.RefundedAmount),
        order.SellerName);

    /// <summary>+380671234567 → "+380 67 *** ** 67": номер видно лише частково.</summary>
    internal static string MaskPhone(string phone) =>
        phone.Length == 13 && phone.StartsWith("+380", StringComparison.Ordinal)
            ? $"+380 {phone[4..6]} *** ** {phone[^2..]}"
            : "***";

    public static ProblemHttpResult OrderNotFound() =>
        Problems.NotFound("ordering.order_not_found", "Замовлення не знайдено", "Перевірте посилання на сторінку замовлення.");
}
