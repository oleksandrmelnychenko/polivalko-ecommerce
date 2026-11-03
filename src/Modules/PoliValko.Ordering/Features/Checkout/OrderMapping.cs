using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Checkout;

internal static class OrderMapping
{
    public static bool CanPay(Order order) =>
        order.PaymentMethod == PaymentMethod.Card
        && order.Status == OrderStatus.AwaitingPayment
        && order.PaymentStatus is PaymentStatus.Pending or PaymentStatus.Failed;

    public static OrderItemDto ToDto(OrderItem i) => new(
        i.ProductId,
        i.Slug,
        i.Sku,
        i.Name,
        i.ImageUrl,
        MoneyDto.Hryvnia(i.UnitPrice),
        i.Quantity,
        MoneyDto.Hryvnia(i.LineTotal));

    public static OrderDto ToDto(Order order) => new(
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

    public static string MaskPhone(string phone) =>
        phone.Length == 13 && phone.StartsWith("+380", StringComparison.Ordinal)
            ? $"+380 {phone[4..6]} *** ** {phone[^2..]}"
            : "***";
}
