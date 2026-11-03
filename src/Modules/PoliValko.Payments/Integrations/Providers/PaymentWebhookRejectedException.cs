namespace PoliValko.Payments.Integrations.Providers;

public sealed class PaymentWebhookRejectedException(string message) : Exception(message);
