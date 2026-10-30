namespace PoliValko.Delivery.NovaPoshta;

/// <summary>Налаштування інтеграції з API Нової пошти 2.0 (секція <c>Delivery:NovaPoshta</c>).</summary>
internal sealed class NovaPoshtaOptions
{
    public const string Section = "Delivery:NovaPoshta";

    /// <summary>Ключ API 2.0. Без нього вітрина працює з демо-довідником, а синхронізація вимкнена.</summary>
    public string? ApiKey { get; set; }

    public string BaseUrl { get; set; } = "https://api.novaposhta.ua/v2.0/json/";

    /// <summary>Як часто оновлювати локальну копію довідника.</summary>
    public TimeSpan SyncInterval { get; set; } = TimeSpan.FromDays(1);

    /// <summary>Записів на сторінку в getCities / getWarehouses.</summary>
    public int PageSize { get; set; } = 500;

    /// <summary>Пауза між сторінками, щоб не впиратися в ліміти API.</summary>
    public TimeSpan PageDelay { get; set; } = TimeSpan.FromMilliseconds(300);

    /// <summary>Скільки разів повторювати запит після тимчасового збою (HTTP 429/5xx, мережа, ліміт запитів).</summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>Перша пауза перед повтором; далі подвоюється. Retry-After від сервера має пріоритет.</summary>
    public TimeSpan RetryDelay { get; set; } = TimeSpan.FromSeconds(2);

    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(60);

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
