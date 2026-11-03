using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace PoliValko.Catalog.Features.Storefront;

internal static class CatalogEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Catalog");

        group.MapGet("/categories", GetCategoryTree.HandleAsync)
            .WithName("GetCategoryTree")
            .WithSummary("Дерево видимих категорій");

        group.MapGet("/categories/{slug}", GetCategory.HandleAsync)
            .WithName("GetCategory")
            .WithSummary("Категорія з хлібними крихтами та підкатегоріями")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/products", SearchProducts.HandleAsync)
            .WithName("SearchProducts")
            .WithSummary("Пошук, фільтри, сортування й пагінація товарів із фасетами")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/products/{slug}", GetProduct.HandleAsync)
            .WithName("GetProduct")
            .WithSummary("Картка товару")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/catalog/photo-credits", GetPhotoCredits.HandleAsync)
            .WithName("GetPhotoCredits")
            .WithSummary("Автори й ліцензії фото товарів з відкритих джерел");

        group.MapGet("/collections", GetCollections.HandleAsync)
            .WithName("GetCollections")
            .WithSummary("Редакційні добірки головної з видимими товарами в погодженому порядку");

        group.MapGet("/catalog/sitemap", GetSitemap.HandleAsync)
            .WithName("GetSitemap")
            .WithSummary("Адреси видимих розділів і товарів для sitemap.xml");

        group.MapGet("/redirects/resolve", ResolveRedirect.HandleAsync)
            .WithName("ResolveRedirect")
            .WithSummary("Нова адреса для старого опублікованого шляху (постійне перенаправлення)")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return api;
    }
}
