using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class ProductEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var products = catalog.MapGroup("/products").RequireStaff(PermissionKeys.ProductsView);
        products.MapGet(string.Empty, ListProducts.HandleAsync)
            .WithName("ConsoleListProducts")
            .WithSummary("Товари: пошук за назвою чи артикулом, фільтр за розділом, видимістю й залишком");
        products.MapPost("/visibility", SetProductsVisibility.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsEdit)
            .WithName("ConsoleSetProductsVisibility")
            .WithSummary("Показати або приховати кілька товарів одним запитом (до 200)");
        products.MapGet("/{id:guid}", GetConsoleProduct.HandleAsync)
            .WithName("ConsoleGetProduct")
            .WithSummary("Товар: поля Navkolo (лише читання) і поля сайту")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPut("/{id:guid}", UpdateProduct.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsEdit)
            .WithName("ConsoleUpdateProduct")
            .WithSummary("Поля сайту: назва для вітрини, адреса, розділ, опис, характеристики, SEO, видимість")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPost("/{id:guid}/images", UploadProductImage.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsEdit)
            .DisableAntiforgery()
            .WithName("ConsoleUploadProductImage")
            .WithSummary("Завантаження фото (JPEG, PNG або WebP, до 10 МБ)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPut("/{id:guid}/images", UpdateProductImages.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsEdit)
            .WithName("ConsoleUpdateProductImages")
            .WithSummary("Порядок фото та підписи alt")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapDelete("/{id:guid}/images/{imageId:guid}", DeleteProductImage.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsEdit)
            .WithName("ConsoleDeleteProductImage")
            .WithSummary("Видалення фото")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapGet("/counts", CountProducts.HandleAsync)
            .WithName("ConsoleProductCounts")
            .WithSummary("Кількість товарів для швидких вкладок: усі, потребують заповнення, нові за 30 днів, приховані з залишком, без залишку");
        products.MapPost("/bulk", BulkUpdateProducts.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsEdit)
            .WithName("ConsoleBulkUpdateProducts")
            .WithSummary("Масова зміна до 200 товарів: розділ, бренд (порожній рядок прибирає бренд), мітки, видимість");

        return catalog;
    }
}
