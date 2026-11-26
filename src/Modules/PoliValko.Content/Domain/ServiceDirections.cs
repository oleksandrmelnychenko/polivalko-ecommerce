namespace PoliValko.Content.Domain;

public static class ServiceDirections
{
    public static readonly IReadOnlyList<ServiceDirection> All =
    [
        new("landscape-design", "Ландшафтний дизайн", "landshaftnyi-dyzain"),
        new("irrigation-installation", "Проєктування і монтаж автополиву", "montazh-avtopolyvu"),
        new("greening", "Озеленення", "ozelenennia"),
        new("lawns", "Газони", "hazony"),
        new("garden-care", "Догляд за садом", "dohliad-za-sadom"),
        new("irrigation-service", "Сервіс автополиву", "servis-avtopolyvu"),
        new("plant-treatment", "Обробка рослин", "obrobka-roslyn"),
    ];

    public static ServiceDirection? Find(string? code) => All.FirstOrDefault(d => d.Code == code);

    /// <summary>The address the service page has now: the console's own slug, or the default one.</summary>
    public static string SlugOf(ServiceDirection direction, ServiceDirectionContent? content) =>
        string.IsNullOrWhiteSpace(content?.Slug) ? direction.Slug : content.Slug;
}
