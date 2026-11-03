namespace PoliValko.Payments.Integrations.Providers;

public sealed record ProviderRefundResult(bool Accepted, string? ProviderRef, string? Error);
