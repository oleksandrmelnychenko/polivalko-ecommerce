using PoliValko.Fiscal.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Fiscal.Features.Receipts;

public sealed record ReceiptDto(
    Guid Id,
    ReceiptKind Kind,
    ReceiptStatus Status,
    MoneyDto Amount,
    string PaymentType,
    string Provider,
    string? FiscalCode,
    string? Url,
    DateTimeOffset CreatedAt,
    DateTimeOffset? IssuedAt,
    string? Error);
