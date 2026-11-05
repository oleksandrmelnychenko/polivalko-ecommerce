using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Checkout;

public static class QuoteIssues
{
    public const string InsufficientStock = "insufficient_stock";
    public const string Unavailable = "unavailable";
}

public sealed record CartLineRequest(Guid ProductId, int Quantity);

public sealed record QuoteRequest(IReadOnlyList<CartLineRequest>? Items);

public sealed record QuoteLineDto(
    Guid ProductId,
    string Slug,
    string Sku,
    string Name,
    string? ImageUrl,
    MoneyDto UnitPrice,
    int Quantity,
    int AvailableQuantity,
    MoneyDto LineTotal,
    string? Issue);

public sealed record PaymentMethodOptionDto(string Code, string Name);

public sealed record DeliveryMethodOptionDto(
    string Code,
    string Name,
    IReadOnlyList<PaymentMethodOptionDto> PaymentMethods,
    string? Description = null,
    string? PriceNote = null);

public sealed record QuoteDto(
    IReadOnlyList<QuoteLineDto> Items,
    MoneyDto Subtotal,
    MoneyDto Total,
    string DeliveryNote,
    IReadOnlyList<DeliveryMethodOptionDto> DeliveryMethods,
    bool DataFresh);

public sealed record CustomerRequest(string? Name, string? Phone, string? Email);

public sealed record DeliveryAddressRequest(string? Street, string? House, string? Apartment);

public sealed record DeliveryRequest(string? Method, string? SettlementRef, string? WarehouseRef, DeliveryAddressRequest? Address = null);

public sealed record PaymentRequest(string? Method);

public sealed record CreateOrderRequest(
    IReadOnlyList<CartLineRequest>? Items,
    string? ExpectedTotal,
    CustomerRequest? Customer,
    DeliveryRequest? Delivery,
    PaymentRequest? Payment,
    string? Comment,
    bool AcceptOffer);

public sealed record OrderCreatedDto(
    string Number,
    string AccessToken,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    MoneyDto Total,
    bool PaymentRequired);

public sealed record OrderItemDto(
    Guid ProductId,
    string Slug,
    string Sku,
    string Name,
    string? ImageUrl,
    MoneyDto UnitPrice,
    int Quantity,
    MoneyDto LineTotal);

public sealed record OrderDeliveryDto(string? SettlementName, string? WarehouseName, string? PickupAddress, string? Address);

public sealed record OrderCustomerDto(string Name, string Phone);

public sealed record OrderHistoryEntryDto(OrderStatus Status, DateTimeOffset At);

public sealed record OrderDto(
    string Number,
    DateTimeOffset CreatedAt,
    OrderStatus Status,
    string PaymentMethod,
    PaymentStatus PaymentStatus,
    string DeliveryMethod,
    OrderDeliveryDto Delivery,
    OrderCustomerDto Customer,
    IReadOnlyList<OrderItemDto> Items,
    MoneyDto Subtotal,
    MoneyDto Total,
    IReadOnlyList<OrderHistoryEntryDto> History,
    bool CanPay,
    MoneyDto RefundedAmount,
    string SellerName);

public sealed record SellerDto(string Name, string? TaxId, string? Address, string? Iban = null, string? Email = null, string? Phone = null);

public sealed record StockIssueDto(Guid ProductId, int RequestedQuantity, int AvailableQuantity, string Issue);
