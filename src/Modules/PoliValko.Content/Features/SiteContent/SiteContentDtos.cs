namespace PoliValko.Content.Features.SiteContent;

public sealed record PageDto(string Slug, string Title, string? Lead, string? BodyHtml, DateTimeOffset UpdatedAt, string? UpdatedBy);

public sealed record ConsolePageListItemDto(string Slug, string Title, DateTimeOffset UpdatedAt, string? UpdatedBy);

public sealed record SavePageRequest(string? Title, string? Lead, string? BodyHtml);

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
    string? YouTube);

public sealed record ConsoleServiceDirectionDto(string Code, string Name, string? Description, int SortOrder, bool IsVisible);

public sealed record SaveServiceDirectionRequest(string? Description, int SortOrder, bool IsVisible);
