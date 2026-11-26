namespace PoliValko.Content.Features.SiteContent;

public sealed record PageDto(
    string Slug,
    string Title,
    string? Lead,
    string? BodyHtml,
    DateTimeOffset UpdatedAt,
    string? UpdatedBy,
    string? SeoTitle,
    string? SeoDescription);

public sealed record ConsolePageListItemDto(string Slug, string Title, DateTimeOffset UpdatedAt, string? UpdatedBy, string? SeoTitle, string? SeoDescription);

public sealed record SavePageRequest(string? Title, string? Lead, string? BodyHtml, string? SeoTitle = null, string? SeoDescription = null);

public sealed record ContactsDto(
    string? StorePhone,
    string? ServicesPhone,
    string? Email,
    string? Address,
    string? Schedule,
    string? MapUrl,
    string? Instagram,
    string? Facebook,
    string? Telegram,
    string? YouTube,
    string? Viber = null,
    IReadOnlyList<SpecialDayDto>? SpecialDays = null);

public sealed record SpecialDayDto(DateOnly Date, string Label, bool Closed, string? Hours);

public sealed record ConsoleServiceDirectionDto(
    string Code,
    string Name,
    string? Description,
    int SortOrder,
    bool IsVisible,
    string? ImageUrl,
    string Slug,
    string DefaultSlug,
    string? BodyHtml,
    string? SeoTitle,
    string? SeoDescription,
    DateTimeOffset? UpdatedAt);

/// <remarks>
/// Page fields left out (null) keep their saved value, so an older console cannot wipe the page text; an empty string
/// clears the field (an empty slug returns to the default address).
/// </remarks>
public sealed record SaveServiceDirectionRequest(
    string? Description,
    int SortOrder,
    bool IsVisible,
    string? ImageUrl = null,
    string? Slug = null,
    string? BodyHtml = null,
    string? SeoTitle = null,
    string? SeoDescription = null);
