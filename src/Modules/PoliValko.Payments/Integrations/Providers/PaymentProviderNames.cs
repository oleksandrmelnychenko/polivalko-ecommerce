namespace PoliValko.Payments.Integrations.Providers;

public static class PaymentProviderNames
{
    public const string Sandbox = "sandbox";
    public const string Mono = "mono";
    public const string Disabled = "disabled";

    public static bool Is(string? configured, string name) =>
        string.Equals(configured?.Trim(), name, StringComparison.OrdinalIgnoreCase);

    /// <summary>The provider as managers know it, for alerts and order history.</summary>
    public static string Display(string name) => name switch
    {
        Mono => "Plata by mono",
        Sandbox => "Sandbox",
        _ => name,
    };

    public static bool IsKnown(string? configured) =>
        string.IsNullOrWhiteSpace(configured) || Is(configured, Disabled) || Is(configured, Sandbox) || Is(configured, Mono);
}
