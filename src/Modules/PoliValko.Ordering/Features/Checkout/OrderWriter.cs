using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Catalog.Contracts;
using PoliValko.Customers.Contracts;
using PoliValko.Delivery.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Configuration;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Shop;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Checkout;

internal sealed class OrderWriter(
    PoliValkoDbContext db,
    CheckoutCalculator calculator,
    IDeliveryDirectory directory,
    IDeliveryAvailability delivery,
    ICatalogFreshness freshness,
    IOptions<SellerOptions> sellerOptions,
    ISettingsStore settings,
    IOutbox outbox,
    TimeProvider time,
    ICustomerDirectory customers,
    ICatalogReservations reservations)
{
    public async Task<Results<Created<OrderCreatedDto>, ValidationProblem, ProblemHttpResult>> WriteAsync(
        CreateOrderRequest request, HttpRequest http, string idempotencyKey, CancellationToken ct)
    {
        // The response cache expires before the order does. Never recreate an action or expose its token after expiry.
        if (await db.Set<Order>().AnyAsync(o => o.IdempotencyKey == idempotencyKey, ct))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "idempotency.result_expired",
                "Замовлення з цим ключем уже створене",
                "Перевірте історію замовлень або зверніться до підтримки перед повторним оформленням.");
        }

        var availability = await delivery.GetAsync(ct);
        var (errors, valid) = await OrderValidator.ValidateAsync(request, directory, availability, ct);
        if (valid is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        await reservations.LockAsync(request.Items!.Select(i => i.ProductId).ToArray(), ct);
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

        var fresh = await freshness.IsFreshAsync(ct);
        var isCard = valid.Payment == PaymentMethod.Card;
        var status = !fresh ? OrderStatus.AwaitingConfirmation : isCard ? OrderStatus.AwaitingPayment : OrderStatus.New;
        var now = time.GetUtcNow();
        var number = await db.Database
            .SqlQuery<long>($"SELECT nextval('ordering.order_number_seq') AS \"Value\"")
            .SingleAsync(ct);
        var (token, tokenHash) = OrderTokens.Create();
        var orderId = Guid.CreateVersion7(now);
        var pickup = valid.Delivery == DeliveryMethod.Pickup ? availability.Pickup : null;
        var seller = await ShopSettingsStore.LoadSellerAsync(settings, sellerOptions.Value, ct);

        var order = new Order
        {
            Id = orderId,
            Number = $"PV-{number}",
            AccessTokenHash = tokenHash,
            IdempotencyKey = idempotencyKey,
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
            SellerName = seller.Name,
            SellerTaxId = seller.TaxId,
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
        var customerId = http.HttpContext.User.CustomerId()
            ?? (valid.Email is null ? null : await customers.FindConfirmedIdByEmailAsync(valid.Email, ct));
        if (customerId is { } owner)
        {
            order.LinkCustomer(owner);
        }

        order.History.Add(new OrderStatusChange
        {
            Id = Guid.CreateVersion7(now),
            OrderId = orderId,
            From = null,
            To = status,
            At = now,
            By = OrderActors.Customer,
        });

        await reservations.ReserveAsync(order.Id, request.Items!.ToDictionary(i => i.ProductId, i => i.Quantity), ct);
        db.Add(order);
        outbox.Enqueue(new OrderPlaced(order.Id));
        outbox.Enqueue(new OrderExportRequested(order.Id));
        await db.SaveChangesAsync(ct);

        return TypedResults.Created(
            $"/api/v1/orders/{order.Number}",
            new OrderCreatedDto(order.Number, token, order.Status, order.PaymentStatus, MoneyDto.Hryvnia(order.Total), OrderMapping.CanPay(order)));
    }
}
