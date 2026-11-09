using Microsoft.AspNetCore.Http;

namespace PoliValko.Payments.Integrations.Providers;

public interface IPaymentProvider
{
    string Name { get; }

    /// <summary>Whether <see cref="FindRefundAsync"/> can tell a refund the provider never received from one it did.</summary>
    bool CanFindRefunds { get; }

    Task<CreatedInvoice> CreateInvoiceAsync(InvoiceRequest request, CancellationToken ct);

    Task<ProviderPaymentStatus> GetStatusAsync(string providerPaymentId, CancellationToken ct);

    Task<ProviderPaymentStatus> ParseWebhookAsync(byte[] body, IHeaderDictionary headers, CancellationToken ct);

    /// <summary>
    /// Sends a refund identified by the merchant <paramref name="reference"/>. Throws when the outcome is unknown
    /// (timeout, provider error), so the caller asks <see cref="FindRefundAsync"/> before trying again.
    /// </summary>
    Task<ProviderRefundResult> RefundAsync(string providerPaymentId, string reference, decimal amount, IReadOnlyList<PaymentBasketItem> items, CancellationToken ct);

    /// <summary>The state of a refund sent earlier with <paramref name="reference"/>; null when the provider never accepted it.</summary>
    Task<ProviderRefundResult?> FindRefundAsync(string providerPaymentId, string reference, CancellationToken ct);

    /// <summary>Stops an unpaid invoice from accepting money. False when it was already paid and cannot be withdrawn.</summary>
    Task<bool> CancelInvoiceAsync(string providerPaymentId, CancellationToken ct);
}
