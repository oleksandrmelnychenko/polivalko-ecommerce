namespace PoliValko.Catalog.Domain;

/// <summary>
/// Товар. Поля <see cref="NavkoloId"/>, <see cref="Sku"/>, <see cref="Name"/>, <see cref="NavkoloGroupRef"/>,
/// варіанти, ціна й залишок належать Navkolo і змінюються лише імпортом або синхронізацією.
/// Решта (назва для вітрини, опис, фото, характеристики, SEO, видимість, розділ) редагується на сайті.
/// </summary>
public sealed class Product
{
    public Guid Id { get; init; }

    public required string NavkoloId { get; init; }

    public required string Sku { get; set; }

    public required string Name { get; set; }

    /// <summary>Група товарів у Navkolo. За нею новий товар потрапляє в розділ сайту з таким самим зв'язком.</summary>
    public string? NavkoloGroupRef { get; set; }

    /// <summary>Облікові SKU з однаковою групою — варіанти одного товару (розділ 4 ТЗ).</summary>
    public string? VariantGroup { get; set; }

    /// <summary>Підпис варіанта, напр. "20 м".</summary>
    public string? VariantLabel { get; set; }

    /// <summary>Назва для вітрини. Якщо порожня, показується <see cref="Name"/> із Navkolo.</summary>
    public string? DisplayName { get; set; }

    public required string Slug { get; set; }

    public Guid CategoryId { get; set; }

    public string? Brand { get; set; }

    public string? DescriptionHtml { get; set; }

    public bool IsVisible { get; set; }

    public string? SeoTitle { get; set; }

    public string? SeoDescription { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>Остання зміна даних сайту (опис, фото, SEO). Для sitemap.</summary>
    public DateTimeOffset UpdatedAt { get; set; }

    public ProductPrice Price { get; set; } = null!;

    public ProductStock Stock { get; set; } = null!;

    public List<ProductImage> Images { get; set; } = [];

    public List<ProductAttribute> Attributes { get; set; } = [];
}

/// <summary>Ціна в окремій таблиці: синхронізація кожні 5 хв оновлює лише маленькі рядки.</summary>
public sealed class ProductPrice
{
    public Guid ProductId { get; init; }

    public decimal Amount { get; set; }

    /// <summary>Стара ціна для акції. Показується лише тоді, коли Navkolo віддає коректні дані.</summary>
    public decimal? OldAmount { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ProductStock
{
    public Guid ProductId { get; init; }

    public decimal Quantity { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>Фото товару. Редагується на сайті; <see cref="Credit"/> — автор і ліцензія для фото з відкритих джерел.</summary>
public sealed class ProductImage
{
    public Guid Id { get; init; }

    public Guid ProductId { get; init; }

    public required string Url { get; set; }

    public required string Alt { get; set; }

    public int SortOrder { get; set; }

    public string? Credit { get; set; }
}

/// <summary>Характеристика товару: "Довжина" — "20 м". Фільтри розділу будуються за погодженими назвами.</summary>
public sealed class ProductAttribute
{
    public Guid Id { get; init; }

    public Guid ProductId { get; init; }

    public required string Name { get; set; }

    public required string Value { get; set; }

    public int SortOrder { get; set; }
}
