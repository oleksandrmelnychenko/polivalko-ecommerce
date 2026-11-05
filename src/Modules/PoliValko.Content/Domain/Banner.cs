namespace PoliValko.Content.Domain;

public sealed class Banner
{
    public const int KickerLength = 40;

    public const int TitleLength = 80;
    public const int TextLength = 200;
    public const int ButtonLabelLength = 30;
    public const int LinkLength = 300;

    public Guid Id { get; init; }

    public string? Kicker { get; set; }

    public required string Title { get; set; }

    public string? Text { get; set; }

    public string? ButtonLabel { get; set; }

    public string? Link { get; set; }

    public required string ImageUrl { get; set; }

    public string? MobileImageUrl { get; set; }

    public DateTimeOffset? StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public bool IsLive(DateTimeOffset now) =>
        IsActive && (StartsAt is null || StartsAt <= now) && (EndsAt is null || EndsAt >= now);
}
