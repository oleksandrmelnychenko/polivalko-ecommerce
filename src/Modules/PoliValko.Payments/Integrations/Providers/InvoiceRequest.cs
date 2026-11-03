namespace PoliValko.Payments.Integrations.Providers;

public sealed record InvoiceRequest(
    Guid PaymentId,
    string OrderNumber,
    decimal Amount,
    IReadOnlyList<PaymentBasketItem> Basket,
    string RedirectUrl,
    string WebhookUrl,
    DateTimeOffset ExpiresAt);
