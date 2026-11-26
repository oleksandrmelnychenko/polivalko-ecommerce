using PoliValko.SharedKernel;

namespace PoliValko.Payments.Features.Checkout;

/// <param name="Method">The bank or wallet the buyer picked: <c>mono</c>, <c>liqpay</c>, <c>wallet</c>; empty means the first one offered.</param>
public sealed record StartPaymentRequest(string? Token, string? Method = null);

public sealed record StartAccountPaymentRequest(string? Method = null);

public sealed record PaymentOptionDto(string Code, string Name, string Hint);

public sealed record StartPaymentDto(Guid PaymentId, string PageUrl, DateTimeOffset ExpiresAt);

public sealed record SandboxInvoiceDto(string InvoiceId, string OrderNumber, MoneyDto Amount, string Status, DateTimeOffset ExpiresAt);

public sealed record CompleteSandboxPaymentRequest(string? Outcome, bool? Notify);

public sealed record SandboxCompletionDto(string Status, string RedirectUrl);
