namespace PoliValko.Payments.Integrations.Providers;

public enum ProviderRefundState
{
    Succeeded,

    /// <summary>The provider accepted the refund but has not finished it; the money may still not reach the customer.</summary>
    Processing,

    Failed,
}
