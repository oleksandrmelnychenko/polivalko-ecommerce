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

    public string EventKey => $"{ProviderPaymentId}:{State}:{ModifiedAt?.ToUnixTimeMilliseconds()}";
}
