namespace PoliValko.Infrastructure.Storefront;

public sealed class SiteOptions
{
    public string PublicUrl { get; set; } = "http://localhost:8080";

    public string Url(string path) => $"{PublicUrl.TrimEnd('/')}/{path.TrimStart('/')}";
}
