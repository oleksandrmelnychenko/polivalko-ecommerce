namespace PoliValko.Content.Domain;

public sealed record ServiceDirection(string Code, string Name);

/// <summary>Напрямки послуг зі сторінки «Послуги» (розділ 8 ТЗ).</summary>
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
