namespace PoliValko.Infrastructure;

/// <summary>Публічна адреса магазину: посилання повернення з оплати, вебхуки, sitemap.</summary>
public sealed class SiteOptions
{
    public string PublicUrl { get; set; } = "http://localhost:8080";

    public string Url(string path) => $"{PublicUrl.TrimEnd('/')}/{path.TrimStart('/')}";
}
