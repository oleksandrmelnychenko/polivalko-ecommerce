namespace PoliValko.Content.Domain;

public static class ServiceDirections
{
    public static readonly IReadOnlyList<ServiceDirection> All =
    [
        new("landscape-design", "Ландшафтний дизайн"),
        new("irrigation-installation", "Проєктування і монтаж автополиву"),
        new("greening", "Озеленення"),
        new("lawns", "Газони"),
        new("garden-care", "Догляд за садом"),
        new("irrigation-service", "Сервіс автополиву"),
        new("plant-treatment", "Обробка рослин"),
    ];

    public static ServiceDirection? Find(string? code) => All.FirstOrDefault(d => d.Code == code);
}
