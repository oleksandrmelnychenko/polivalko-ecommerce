using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Catalog.Features.Console.Collections;

internal static class CollectionEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var collections = catalog.MapGroup("/collections").RequireStaff(PermissionKeys.CollectionsManage);
        collections.MapGet(string.Empty, ListCollections.HandleAsync)
            .WithName("ConsoleListCollections")
            .WithSummary("Добірки головної");
        collections.MapPost(string.Empty, CreateCollection.HandleAsync)
            .WithName("ConsoleCreateCollection")
            .WithSummary("Нова добірка");
        collections.MapPut("/{id:guid}", UpdateCollection.HandleAsync)
            .WithName("ConsoleUpdateCollection")
            .WithSummary("Назва, порядок, видимість і товари добірки")
            .ProducesProblem(StatusCodes.Status404NotFound);
        collections.MapDelete("/{id:guid}", DeleteCollection.HandleAsync)
            .WithName("ConsoleDeleteCollection")
            .WithSummary("Видалення добірки")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return catalog;
    }
}
