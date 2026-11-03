namespace PoliValko.Delivery.Configuration;

internal sealed class NovaPoshtaOptions
{
    public const string Section = "Delivery:NovaPoshta";

    public string? ApiKey { get; set; }

    public string BaseUrl { get; set; } = "https://api.novaposhta.ua/v2.0/json/";

    public TimeSpan SyncInterval { get; set; } = TimeSpan.FromDays(1);

    public int PageSize { get; set; } = 500;

    public TimeSpan PageDelay { get; set; } = TimeSpan.FromMilliseconds(300);

    public int MaxRetries { get; set; } = 3;

    public TimeSpan RetryDelay { get; set; } = TimeSpan.FromSeconds(2);

    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(60);

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
