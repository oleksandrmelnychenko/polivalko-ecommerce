using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Catalog.Features.Console.Categories;

internal static class CategoryEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var categories = catalog.MapGroup("/categories").RequireStaff();
        categories.MapGet(string.Empty, ListCategories.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsView, PermissionKeys.CategoriesManage)
            .WithName("ConsoleListCategories")
            .WithSummary("Розділи й підрозділи з порядком, видимістю, зв'язком із Navkolo і фільтрами");
        categories.MapPost(string.Empty, CreateCategory.HandleAsync)
            .RequirePermission(PermissionKeys.CategoriesManage)
            .WithName("ConsoleCreateCategory")
            .WithSummary("Новий підрозділ. Верхній рівень відповідає групам Navkolo й не створюється вручну.");
        categories.MapPut("/{id:guid}", UpdateCategory.HandleAsync)
            .RequirePermission(PermissionKeys.CategoriesManage)
            .WithName("ConsoleUpdateCategory")
            .WithSummary("Зміна розділу; зміна адреси створює перенаправлення")
            .ProducesProblem(StatusCodes.Status404NotFound);
        categories.MapDelete("/{id:guid}", DeleteCategory.HandleAsync)
            .RequirePermission(PermissionKeys.CategoriesManage)
            .WithName("ConsoleDeleteCategory")
            .WithSummary("Видалення порожнього підрозділу")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return catalog;
    }
}
