namespace PoliValko.Content.Domain;

/// <summary>Текстова сторінка: оферта, приватність, повернення, доставка й оплата (розділи 3, 9 ТЗ).</summary>
public sealed class ContentPage
{
    public required string Slug { get; init; }

    public required string Title { get; set; }

    /// <summary>Підзаголовок під назвою сторінки.</summary>
    public string? Lead { get; set; }

    /// <summary>HTML після очищення від небезпечної розмітки.</summary>
    public string? BodyHtml { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }
}

/// <summary>Контакти магазину й послуг (розділ 8 ТЗ). Один рядок; дані надає й підтверджує замовник.</summary>
public sealed class SiteContacts
{
    public const int SingletonId = 1;

    public int Id { get; init; } = SingletonId;

    public string? StorePhone { get; set; }

    public string? ServicesPhone { get; set; }

    public string? Email { get; set; }

    public string? Address { get; set; }

    public string? Schedule { get; set; }

    /// <summary>Посилання на маршрут (Google Maps тощо).</summary>
    public string? MapUrl { get; set; }

    public string? Instagram { get; set; }

    public string? Facebook { get; set; }

    public string? Telegram { get; set; }

    public string? YouTube { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>Короткий опис напрямку послуг, що редагується в адмінці. Коди й назви — у <see cref="ServiceDirections"/>.</summary>
public sealed class ServiceDirectionContent
{
    public required string Code { get; init; }

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public bool IsVisible { get; set; } = true;
}
