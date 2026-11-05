namespace PoliValko.Infrastructure.Settings;

public sealed class PlatformSetting
{
    public required string Key { get; init; }

    public required string Value { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public required string UpdatedBy { get; set; }
}
