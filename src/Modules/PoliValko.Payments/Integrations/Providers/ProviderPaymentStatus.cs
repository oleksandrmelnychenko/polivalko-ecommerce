namespace PoliValko.Payments.Integrations.Providers;

public sealed record ProviderPaymentStatus(
    string ProviderPaymentId,
    ProviderPaymentState State,
    decimal? Amount,
    DateTimeOffset? ModifiedAt,
    string? FailureReason)
{
    public string EventKey => $"{ProviderPaymentId}:{State}:{ModifiedAt?.ToUnixTimeMilliseconds()}";
}
