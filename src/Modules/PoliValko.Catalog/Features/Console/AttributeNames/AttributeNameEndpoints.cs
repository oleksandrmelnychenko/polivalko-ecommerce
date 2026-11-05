using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Catalog.Features.Console.AttributeNames;

internal static class AttributeNameEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        catalog.MapGroup("/attribute-names").RequireStaff(PermissionKeys.ProductsView)
            .MapGet(string.Empty, ListAttributeNames.HandleAsync)
            .WithName("ConsoleListAttributeNames")
            .WithSummary("Назви характеристик товарів розділу (для налаштування фільтрів)");

        return catalog;
    }
}
