using PoliValko.Payments.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Payments.Features.Console;

public sealed record ConsolePaymentDto(
    Guid Id,
    string Provider,
    string? ProviderPaymentId,
    MoneyDto Amount,
    PaymentAttemptStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? FailureReason,
    int EventsCount);
