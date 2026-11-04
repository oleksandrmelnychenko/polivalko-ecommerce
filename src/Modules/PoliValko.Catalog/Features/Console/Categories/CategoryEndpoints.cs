using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Catalog.Features.Console.Categories;

internal static class CategoryEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var categories = catalog.MapGroup("/categories").RequireStaff(StaffPolicies.Admin);
        categories.MapGet(string.Empty, ListCategories.HandleAsync)
            .WithName("ConsoleListCategories")
            .WithSummary("Розділи й підрозділи з порядком, видимістю, зв'язком із Navkolo і фільтрами");
        categories.MapPost(string.Empty, CreateCategory.HandleAsync)
            .WithName("ConsoleCreateCategory")
            .WithSummary("Новий підрозділ. Верхній рівень відповідає групам Navkolo й не створюється вручну.");
        categories.MapPut("/{id:guid}", UpdateCategory.HandleAsync)
            .WithName("ConsoleUpdateCategory")
            .WithSummary("Зміна розділу; зміна адреси створює перенаправлення")
            .ProducesProblem(StatusCodes.Status404NotFound);
        categories.MapDelete("/{id:guid}", DeleteCategory.HandleAsync)
            .WithName("ConsoleDeleteCategory")
            .WithSummary("Видалення порожнього підрозділу")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return catalog;
    }
}
