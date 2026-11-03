using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Catalog.Features.Admin.Products;

internal static class ProductEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var products = catalog.MapGroup("/products").RequireStaff();
        products.MapGet(string.Empty, ListProducts.HandleAsync)
            .WithName("AdminListProducts")
            .WithSummary("Товари: пошук за назвою чи артикулом, фільтр за розділом, видимістю й залишком");
        products.MapPost("/visibility", SetProductsVisibility.HandleAsync)
            .WithName("AdminSetProductsVisibility")
            .WithSummary("Показати або приховати кілька товарів одним запитом (до 200)");
        products.MapGet("/{id:guid}", GetAdminProduct.HandleAsync)
            .WithName("AdminGetProduct")
            .WithSummary("Товар: поля Navkolo (лише читання) і поля сайту")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPut("/{id:guid}", UpdateProduct.HandleAsync)
            .WithName("AdminUpdateProduct")
            .WithSummary("Поля сайту: назва для вітрини, адреса, розділ, опис, характеристики, SEO, видимість")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPost("/{id:guid}/images", UploadProductImage.HandleAsync)
            .DisableAntiforgery()
            .WithName("AdminUploadProductImage")
            .WithSummary("Завантаження фото (JPEG, PNG або WebP, до 10 МБ)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPut("/{id:guid}/images", UpdateProductImages.HandleAsync)
            .WithName("AdminUpdateProductImages")
            .WithSummary("Порядок фото та підписи alt")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapDelete("/{id:guid}/images/{imageId:guid}", DeleteProductImage.HandleAsync)
            .WithName("AdminDeleteProductImage")
            .WithSummary("Видалення фото")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return catalog;
    }
}
