namespace PoliValko.Ordering.Contracts;

public sealed record OrderForExport(
    Guid Id,
    string Number,
    DateTimeOffset CreatedAt,
    string CustomerName,
    string CustomerPhone,
    DeliveryMethod DeliveryMethod,
    string? SettlementName,
    string? WarehouseName,
    string? DeliveryAddress,
    string? PickupAddress,
    PaymentMethod PaymentMethod,
    decimal Total,
    string? Comment,
    string? NavkoloOrderRef,
    IReadOnlyList<OrderForExportLine> Lines);
