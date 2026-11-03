using PoliValko.SharedKernel;

namespace PoliValko.Payments.Features.Checkout;

public sealed record StartPaymentRequest(string? Token);

public sealed record StartPaymentDto(Guid PaymentId, string PageUrl, DateTimeOffset ExpiresAt);

public sealed record SandboxInvoiceDto(string InvoiceId, string OrderNumber, MoneyDto Amount, string Status, DateTimeOffset ExpiresAt);

public sealed record CompleteSandboxPaymentRequest(string? Outcome, bool? Notify);

public sealed record SandboxCompletionDto(string Status, string RedirectUrl);
