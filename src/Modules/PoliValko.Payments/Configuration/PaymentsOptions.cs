namespace PoliValko.Payments.Configuration;

public sealed class PaymentsOptions
{
    public string? Provider { get; set; }

    public TimeSpan InvoiceValidity { get; set; } = TimeSpan.FromHours(1);

    public SandboxOptions Sandbox { get; set; } = new();

    public MonoOptions Mono { get; set; } = new();
}
