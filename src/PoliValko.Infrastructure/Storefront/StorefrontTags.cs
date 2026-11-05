namespace PoliValko.Infrastructure.Storefront;

public static class StorefrontTags
{
    public const string Catalog = "catalog";
    public const string Products = "products";
    public const string Categories = "categories";
    public const string Collections = "collections";
    public const string Content = "content";
    public const string Delivery = "delivery";
    public const string Site = "site";
    public const string Home = "home";

    public static string Product(string slug) => $"product:{slug}";

    public static string Category(string slug) => $"category:{slug}";

    public static string Page(string slug) => $"page:{slug}";
}
