namespace PoliValko.Fiscal.Configuration;

public sealed class CheckboxOptions
{
    public string BaseUrl { get; set; } = "https://api.checkbox.ua";

    public string? LicenseKey { get; set; }

    public string? CashierLogin { get; set; }

    public string? CashierPassword { get; set; }
}
