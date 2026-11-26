namespace PoliValko.Payments.Integrations.Providers;

/// <summary>Merchant keys, read when a provider calls its bank so a console change applies to the next call.</summary>
internal interface IPaymentCredentials
{
    Task<string?> MonoTokenAsync(CancellationToken ct);

    Task<LiqPayKeys?> LiqPayAsync(CancellationToken ct);
}

internal sealed record LiqPayKeys(string PublicKey, string PrivateKey, string Signature);

/// <summary>Keys typed in the console but not saved yet: used to check them before saving.</summary>
internal sealed class FixedPaymentCredentials(string? monoToken, LiqPayKeys? liqPay) : IPaymentCredentials
{
    public Task<string?> MonoTokenAsync(CancellationToken ct) => Task.FromResult(monoToken);

    public Task<LiqPayKeys?> LiqPayAsync(CancellationToken ct) => Task.FromResult(liqPay);
}
