namespace PoliValko.Payments.Integrations.Providers;

public sealed record ProviderPaymentStatus(
    string ProviderPaymentId,
    ProviderPaymentState State,
    decimal? Amount,
    DateTimeOffset? ModifiedAt,
    string? FailureReason)
{
    /// <summary>
    /// For <see cref="ProviderPaymentState.Reversed"/>: what is still held on the invoice after the return.
    /// Null when the provider does not say, which counts as a full return.
    /// </summary>
    public decimal? RemainingAmount { get; init; }

    /// <summary>The message as JSON for the event log, when the provider's own body is not JSON (LiqPay posts a form).</summary>
    public string? Payload { get; init; }

    public string EventKey => $"{ProviderPaymentId}:{State}:{ModifiedAt?.ToUnixTimeMilliseconds()}";
}
