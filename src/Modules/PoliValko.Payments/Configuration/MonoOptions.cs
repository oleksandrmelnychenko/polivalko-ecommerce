namespace PoliValko.Payments.Configuration;

public sealed class MonoOptions
{
    public string BaseUrl { get; set; } = "https://api.monobank.ua";

    public string? Token { get; set; }
}
