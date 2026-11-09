namespace PoliValko.Payments.Integrations.Providers;

public sealed record ProviderRefundResult(ProviderRefundState State, string? Error = null)
{
    public static ProviderRefundResult Succeeded { get; } = new(ProviderRefundState.Succeeded);

    public static ProviderRefundResult Processing { get; } = new(ProviderRefundState.Processing);

    public static ProviderRefundResult Failed(string error) => new(ProviderRefundState.Failed, error);
}
