using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class ConsoleOrderMapping
{
    public static RefundMethod? RefundMethodFor(Order order) => order switch
    {
        { PaymentMethod: PaymentMethod.Card, PaymentStatus: PaymentStatus.Succeeded or PaymentStatus.PartiallyRefunded } => RefundMethod.Provider,
        { PaymentMethod: not PaymentMethod.Card, Status: OrderStatus.Completed } => RefundMethod.Manual,
        _ => null,
    };

    public static IEnumerable<RefundableItemDto> Refundable(Order order)
    {
        var returned = order.Refunds
            .Where(r => r.Status != RefundStatus.Failed)
            .SelectMany(r => r.Lines)
            .GroupBy(l => l.OrderItemId)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.Quantity));
        return order.Items
            .Select(i => new RefundableItemDto(i.ProductId, i.Quantity - returned.GetValueOrDefault(i.Id)))
            .Where(r => r.Quantity > 0);
    }

    public static ConsoleOrderDto ToDto(Order order)
    {
        var items = order.Items.ToDictionary(i => i.Id);
        var method = RefundMethodFor(order);
        return new ConsoleOrderDto(
            order.Number,
            order.CreatedAt,
            order.Status,
            PaymentCodes.From(order.PaymentMethod),
            order.PaymentStatus,
            DeliveryCodes.From(order.DeliveryMethod),
            order.SettlementName,
            order.WarehouseName,
            order.PickupAddress,
            order.CustomerName,
            order.CustomerPhone,
            order.CustomerEmail,
            order.Comment,
            order.Items.Select(OrderMapping.ToDto).ToList(),
            MoneyDto.Hryvnia(order.Subtotal),
            MoneyDto.Hryvnia(order.Total),
            order.History.OrderBy(h => h.At).Select(h => new ConsoleOrderHistoryDto(h.From, h.To, h.At, h.By, h.Reason)).ToList(),
            OrderTransitions.Allowed(order),
            order.DeliveryAddress,
            order.SellerName,
            order.SellerTaxId,
            order.NavkoloOrderRef,
            order.NavkoloExportedAt,
            MoneyDto.Hryvnia(order.RefundedAmount),
            order.Refunds.OrderBy(r => r.CreatedAt).Select(r => new ConsoleRefundDto(
                r.Id,
                r.CreatedAt,
                r.Method,
                r.Status,
                MoneyDto.Hryvnia(r.Amount),
                r.Reason,
                r.RequestedBy,
                r.CompletedAt,
                r.Error,
                r.Lines.Select(l => new ConsoleRefundLineDto(
                    items[l.OrderItemId].ProductId,
                    items[l.OrderItemId].Sku,
                    items[l.OrderItemId].Name,
                    l.Quantity,
                    MoneyDto.Hryvnia(l.Amount))).ToList())).ToList(),
            method,
            method is null ? [] : Refundable(order).ToList(),
            order.InternalNote,
            order.CustomerId);
    }

    public static ProblemHttpResult NotFound(string number) =>
        Problems.NotFound("ordering.order_not_found", "Замовлення не знайдено", $"Замовлення {number} не існує.");
}
