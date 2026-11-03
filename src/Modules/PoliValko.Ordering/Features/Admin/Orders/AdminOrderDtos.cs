using Microsoft.AspNetCore.Mvc;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Admin.Orders;

public sealed record AdminOrderListItemDto(
    string Number,
    DateTimeOffset CreatedAt,
    string CustomerName,
    string Phone,
    MoneyDto Total,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    string DeliveryMethod,
    int ItemsCount);

public sealed record AdminOrderHistoryDto(OrderStatus? From, OrderStatus To, DateTimeOffset At, string By, string? Reason);

public sealed record AdminRefundLineDto(Guid ProductId, string Sku, string Name, int Quantity, MoneyDto Amount);

public sealed record AdminRefundDto(
    Guid Id,
    DateTimeOffset CreatedAt,
    RefundMethod Method,
    RefundStatus Status,
    MoneyDto Amount,
    string Reason,
    string RequestedBy,
    DateTimeOffset? CompletedAt,
    string? Error,
    IReadOnlyList<AdminRefundLineDto> Lines);

public sealed record RefundableItemDto(Guid ProductId, int Quantity);

public sealed record AdminOrderDto(
    string Number,
    DateTimeOffset CreatedAt,
    OrderStatus Status,
    string PaymentMethod,
    PaymentStatus PaymentStatus,
    string DeliveryMethod,
    string? SettlementName,
    string? WarehouseName,
    string? PickupAddress,
    string CustomerName,
    string Phone,
    string? Email,
    string? Comment,
    IReadOnlyList<OrderItemDto> Items,
    MoneyDto Subtotal,
    MoneyDto Total,
    IReadOnlyList<AdminOrderHistoryDto> History,
    IReadOnlyList<OrderStatus> AllowedTransitions,
    string? DeliveryAddress,
    string SellerName,
    string? SellerTaxId,
    string? NavkoloOrderRef,
    DateTimeOffset? NavkoloExportedAt,
    MoneyDto RefundedAmount,
    IReadOnlyList<AdminRefundDto> Refunds,
    RefundMethod? RefundMethod,
    IReadOnlyList<RefundableItemDto> Refundable);

public sealed record ChangeOrderStatusRequest(OrderStatus? Status, string? Reason);

public sealed record RefundLineRequest(Guid ProductId, int Quantity);

public sealed record CreateRefundRequest(IReadOnlyList<RefundLineRequest>? Lines, string? Reason);

public sealed record AdminOrderQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "paymentStatus")] string? PaymentStatus,
    [FromQuery(Name = "delivery")] string? Delivery,
    [FromQuery(Name = "from")] DateOnly? From,
    [FromQuery(Name = "to")] DateOnly? To,
    [FromQuery(Name = "sort")] string? Sort,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

public sealed record AdminOrderCountsQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "paymentStatus")] string? PaymentStatus,
    [FromQuery(Name = "delivery")] string? Delivery,
    [FromQuery(Name = "from")] DateOnly? From,
    [FromQuery(Name = "to")] DateOnly? To);

public sealed record AdminOrderExportQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "paymentStatus")] string? PaymentStatus,
    [FromQuery(Name = "delivery")] string? Delivery,
    [FromQuery(Name = "from")] DateOnly? From,
    [FromQuery(Name = "to")] DateOnly? To,
    [FromQuery(Name = "sort")] string? Sort);

public sealed record AdminOrderCountsDto(int All, IReadOnlyList<OrderStatusCountDto> ByStatus);
