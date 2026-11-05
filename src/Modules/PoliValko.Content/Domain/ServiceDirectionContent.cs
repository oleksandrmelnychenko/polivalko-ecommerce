namespace PoliValko.Content.Domain;

public sealed class ServiceDirectionContent
{
    public required string Code { get; init; }

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    public string? ImageUrl { get; set; }
}
