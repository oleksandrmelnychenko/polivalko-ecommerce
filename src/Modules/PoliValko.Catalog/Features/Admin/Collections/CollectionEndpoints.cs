using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Catalog.Features.Admin.Collections;

internal static class CollectionEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var collections = catalog.MapGroup("/collections").RequireStaff();
        collections.MapGet(string.Empty, ListCollections.HandleAsync)
            .WithName("AdminListCollections")
            .WithSummary("Добірки головної");
        collections.MapPost(string.Empty, CreateCollection.HandleAsync)
            .WithName("AdminCreateCollection")
            .WithSummary("Нова добірка");
        collections.MapPut("/{id:guid}", UpdateCollection.HandleAsync)
            .WithName("AdminUpdateCollection")
            .WithSummary("Назва, порядок, видимість і товари добірки")
            .ProducesProblem(StatusCodes.Status404NotFound);
        collections.MapDelete("/{id:guid}", DeleteCollection.HandleAsync)
            .WithName("AdminDeleteCollection")
            .WithSummary("Видалення добірки")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return catalog;
    }
}
