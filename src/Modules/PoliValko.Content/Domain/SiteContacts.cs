namespace PoliValko.Content.Domain;

public sealed class SiteContacts
{
    public const int SingletonId = 1;

    public int Id { get; init; } = SingletonId;

    public string? StorePhone { get; set; }

    public string? ServicesPhone { get; set; }

    public string? Email { get; set; }

    public string? Address { get; set; }

    public string? Schedule { get; set; }

    public string? MapUrl { get; set; }

    public string? Instagram { get; set; }

    public string? Facebook { get; set; }

    public string? Telegram { get; set; }

    public string? YouTube { get; set; }

    public string? Viber { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
