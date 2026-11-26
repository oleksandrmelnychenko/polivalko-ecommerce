namespace PoliValko.Content.Domain;

public sealed class ServiceDirectionContent
{
    public const int SlugLength = 100;

    public required string Code { get; init; }

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    public string? ImageUrl { get; set; }

    /// <summary>Own address of the service page; null keeps <see cref="ServiceDirection.Slug"/>.</summary>
    public string? Slug { get; set; }

    /// <summary>Text of the service page. A page without it is kept out of search (noindex, no sitemap).</summary>
    public string? BodyHtml { get; set; }

    public string? SeoTitle { get; set; }

    public string? SeoDescription { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
