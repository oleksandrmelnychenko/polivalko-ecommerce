namespace PoliValko.Navkolo.Configuration;

public sealed class NavkoloOptions
{
    public string Mode { get; set; } = NavkoloModes.Disabled;

    public TimeSpan SyncInterval { get; set; } = TimeSpan.FromMinutes(5);

    public TimeSpan CatalogInterval { get; set; } = TimeSpan.FromDays(1);

    public TimeSpan FreshnessThreshold { get; set; } = TimeSpan.FromMinutes(20);

    public string ApiKey { get; set; } = string.Empty;
    public string? StoreId { get; set; }
    public string Channel { get; set; } = "Poli-Valko";
    public int? OrderStatusId { get; set; }
    public int? CancellationStatusId { get; set; }

    public StubOptions Stub { get; set; } = new();

    public bool IsEnabled => !string.Equals(Mode, NavkoloModes.Disabled, StringComparison.OrdinalIgnoreCase);
}
