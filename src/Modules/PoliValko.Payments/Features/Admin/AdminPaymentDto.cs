using PoliValko.Payments.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Payments.Features.Admin;

public sealed record AdminPaymentDto(
    Guid Id,
    string Provider,
    string? ProviderPaymentId,
    MoneyDto Amount,
    PaymentAttemptStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? FailureReason,
    int EventsCount);
