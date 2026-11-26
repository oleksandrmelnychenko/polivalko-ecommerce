namespace PoliValko.Content.Features.ServiceRequests;

/// <param name="Slug">Address of the service page: <c>/services/{slug}</c>.</param>
/// <param name="HasPage">The page has its own text; without it the page stays out of search.</param>
public sealed record ServiceDirectionDto(string Code, string Name, string? Description, string? ImageUrl, string Slug, bool HasPage);

public sealed record ServiceDirectionPageDto(
    string Code,
    string Slug,
    string Name,
    string? Description,
    string? ImageUrl,
    string? BodyHtml,
    string? SeoTitle,
    string? SeoDescription,
    DateTimeOffset? UpdatedAt);

public sealed record CreateServiceRequest(string? Name, string? Phone, string? Direction, string? Comment, string[]? AdditionalDirections = null);

public sealed record ServiceRequestCreated(Guid Id);
