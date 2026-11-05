using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Catalog.Features.Console.Brands;

internal static class BrandEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var brands = catalog.MapGroup("/brands").RequireStaff();
        brands.MapGet(string.Empty, ListBrands.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsView, PermissionKeys.BrandsManage)
            .WithName("ConsoleListBrands")
            .WithSummary("Довідник брендів з кількістю товарів");
        brands.MapPost(string.Empty, CreateBrand.HandleAsync)
            .RequirePermission(PermissionKeys.BrandsManage)
            .WithName("ConsoleCreateBrand")
            .WithSummary("Новий бренд");
        brands.MapPut("/{id:guid}", UpdateBrand.HandleAsync)
            .RequirePermission(PermissionKeys.BrandsManage)
            .WithName("ConsoleUpdateBrand")
            .WithSummary("Зміна бренду; нова назва переписується в усіх його товарах")
            .ProducesProblem(StatusCodes.Status404NotFound);
        brands.MapDelete("/{id:guid}", DeleteBrand.HandleAsync)
            .RequirePermission(PermissionKeys.BrandsManage)
            .WithName("ConsoleDeleteBrand")
            .WithSummary("Видалення бренду без товарів")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        brands.MapPost("/{id:guid}/merge", MergeBrand.HandleAsync)
            .RequirePermission(PermissionKeys.BrandsManage)
            .WithName("ConsoleMergeBrand")
            .WithSummary("Об'єднання: товари бренду переходять до іншого бренду, цей бренд видаляється")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return catalog;
    }
}
