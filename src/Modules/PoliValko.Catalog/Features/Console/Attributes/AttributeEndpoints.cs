using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Catalog.Features.Console.Attributes;

internal static class AttributeEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var attributes = catalog.MapGroup("/attributes").RequireStaff();
        attributes.MapGet(string.Empty, ListAttributeDefinitions.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsView, PermissionKeys.AttributesManage, PermissionKeys.CategoriesManage)
            .WithName("ConsoleListAttributeDefinitions")
            .WithSummary("Довідник характеристик: одиниця, тип, вигляд фільтра, синоніми, кількість товарів і категорій з фільтром");
        attributes.MapPost(string.Empty, CreateAttributeDefinition.HandleAsync)
            .RequirePermission(PermissionKeys.AttributesManage)
            .WithName("ConsoleCreateAttributeDefinition")
            .WithSummary("Нова характеристика в довіднику");
        attributes.MapPut("/{id:guid}", UpdateAttributeDefinition.HandleAsync)
            .RequirePermission(PermissionKeys.AttributesManage)
            .WithName("ConsoleUpdateAttributeDefinition")
            .WithSummary("Зміна характеристики; нова назва переписується в усіх товарах і фільтрах категорій однією транзакцією")
            .ProducesProblem(StatusCodes.Status404NotFound);
        attributes.MapDelete("/{id:guid}", DeleteAttributeDefinition.HandleAsync)
            .RequirePermission(PermissionKeys.AttributesManage)
            .WithName("ConsoleDeleteAttributeDefinition")
            .WithSummary("Видалення з довідника; значення в товарах лишаються. Не можна, поки характеристика є фільтром категорії.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return catalog;
    }
}
