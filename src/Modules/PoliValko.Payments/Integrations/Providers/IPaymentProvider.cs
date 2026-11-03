using Microsoft.AspNetCore.Http;

namespace PoliValko.Payments.Integrations.Providers;

public interface IPaymentProvider
{
    string Name { get; }

    Task<CreatedInvoice> CreateInvoiceAsync(InvoiceRequest request, CancellationToken ct);

    Task<ProviderPaymentStatus> GetStatusAsync(string providerPaymentId, CancellationToken ct);

    Task<ProviderPaymentStatus> ParseWebhookAsync(byte[] body, IHeaderDictionary headers, CancellationToken ct);

    Task<ProviderRefundResult> RefundAsync(string providerPaymentId, Guid refundId, decimal amount, IReadOnlyList<PaymentBasketItem> items, CancellationToken ct);
}
