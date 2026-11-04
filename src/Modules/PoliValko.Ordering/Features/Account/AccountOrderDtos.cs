using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Account;

public sealed record AccountOrderListItemDto(
    string Number,
    DateTimeOffset CreatedAt,
    OrderStatus Status,
    string PaymentMethod,
    PaymentStatus PaymentStatus,
    string DeliveryMethod,
    MoneyDto Total,
    int ItemCount,
    string MainItemName,
    string? MainItemImageUrl,
    bool CanPay);
