namespace PoliValko.Content.Domain;

public sealed class ContentPage
{
    public required string Slug { get; init; }

    public required string Title { get; set; }

    public string? Lead { get; set; }

    public string? BodyHtml { get; set; }

    public string? SeoTitle { get; set; }

    public string? SeoDescription { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }
}
