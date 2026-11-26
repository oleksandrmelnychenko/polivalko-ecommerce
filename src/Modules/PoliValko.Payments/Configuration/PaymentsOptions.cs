namespace PoliValko.Payments.Configuration;

public sealed class PaymentsOptions
{
    /// <summary>
    /// Server default until the console saves payment settings: empty or <c>Disabled</c> — off, <c>Sandbox</c> or <c>Mono</c>.
    /// After that the console decides which banks the buyer sees; <c>Sandbox</c> stays server-only.
    /// </summary>
    public string? Provider { get; set; }

    /// <summary>
    /// The test provider lets anyone mark an order paid, so it starts only where this is explicitly on:
    /// development, tests, the local compose stack and staging. Production compose pins it off.
    /// </summary>
    public bool AllowSandbox { get; set; }

    public TimeSpan InvoiceValidity { get; set; } = TimeSpan.FromHours(1);

    public SandboxOptions Sandbox { get; set; } = new();

    public MonoOptions Mono { get; set; } = new();

    public LiqPayOptions LiqPay { get; set; } = new();
}
