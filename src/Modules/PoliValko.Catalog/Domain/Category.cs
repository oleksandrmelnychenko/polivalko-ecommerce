namespace PoliValko.Catalog.Domain;

public sealed class Category
{
    public Guid Id { get; init; }

    public Guid? ParentId { get; set; }

    public required string Slug { get; set; }

    public required string Name { get; set; }

    public int SortOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    /// <summary>Зв'язок із групою товарів у Navkolo. Нові товари цієї групи потрапляють у цей розділ.</summary>
    public string? NavkoloRef { get; set; }

    /// <summary>Погоджений перелік характеристик для фільтрів розділу (розділ 4 ТЗ). Порожній — успадковується від батька.</summary>
    public List<string>? FilterAttributes { get; set; }

    public string? SeoTitle { get; set; }

    public string? SeoDescription { get; set; }
}

/// <summary>Редакційна добірка товарів для головної (розділ 9 ТЗ).</summary>
public sealed class HomeCollection
{
    public Guid Id { get; init; }

    /// <summary>Стабільний код, напр. <c>recommended</c>.</summary>
    public required string Code { get; set; }

    public required string Title { get; set; }

    public int SortOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    /// <summary>Товари в порядку показу.</summary>
    public List<Guid> ProductIds { get; set; } = [];
}

/// <summary>Постійне перенаправлення зі старої адреси після зміни опублікованого URL (розділ 10 ТЗ).</summary>
public sealed class UrlRedirect
{
    public Guid Id { get; init; }

    /// <summary>Шлях без домену, напр. <c>/product/old-slug</c>.</summary>
    public required string FromPath { get; set; }

    public required string ToPath { get; set; }

    /// <summary>Створене автоматично під час зміни slug.</summary>
    public bool IsAutomatic { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
