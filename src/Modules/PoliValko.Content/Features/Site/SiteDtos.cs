namespace PoliValko.Content.Features.Site;

public sealed record HomeBlockDto(string Key, bool Visible);

public sealed record HomeItemDto(string Title, string Text);

public sealed record HomeAnnouncementDto(string Text, string? Link, bool IsActive, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt);

public sealed record HomeSettingsDto(
    IReadOnlyList<HomeBlockDto> Blocks,
    HomeAnnouncementDto Announcement,
    IReadOnlyList<HomeItemDto> Perks,
    IReadOnlyList<HomeItemDto> Steps,
    HomeItemDto Visit);

public sealed record HomeBannerDto(
    Guid Id,
    string Title,
    string? Text,
    string? ButtonLabel,
    string? Link,
    string ImageUrl,
    string? MobileImageUrl,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    string? Kicker);

public sealed record SiteHomeDto(
    HomeAnnouncementDto? Announcement,
    IReadOnlyList<HomeBlockDto> Blocks,
    IReadOnlyList<HomeItemDto> Perks,
    IReadOnlyList<HomeItemDto> Steps,
    HomeItemDto Visit,
    IReadOnlyList<HomeBannerDto> Banners);

public sealed record BannerDto(
    Guid Id,
    string Title,
    string? Text,
    string? ButtonLabel,
    string? Link,
    string ImageUrl,
    string? MobileImageUrl,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    int SortOrder,
    bool IsActive,
    DateTimeOffset UpdatedAt,
    string? Kicker);

public sealed record SaveBannerRequest(
    string? Title,
    string? Text,
    string? ButtonLabel,
    string? Link,
    string? ImageUrl,
    string? MobileImageUrl,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    bool IsActive,
    string? Kicker = null);

public sealed record ReorderBannersRequest(IReadOnlyList<Guid>? Ids);

public sealed record SeoTemplateDto(string Title, string Description);

public sealed record SeoTemplatesDto(SeoTemplateDto Product, SeoTemplateDto Category);
