namespace PoliValko.Payments.Integrations.Providers;

public enum ProviderPaymentState
{
    Created,
    Processing,
    Succeeded,
    Failed,
    Expired,
    Reversed,
}
