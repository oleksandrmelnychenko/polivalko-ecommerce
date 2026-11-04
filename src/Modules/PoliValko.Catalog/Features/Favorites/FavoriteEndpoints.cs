using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Customers.Contracts;

namespace PoliValko.Catalog.Features.Favorites;

internal static class FavoriteEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/account/favorites").WithTags("Account").RequireCustomer();

        group.MapGet(string.Empty, ListFavorites.HandleAsync)
            .WithName("AccountListFavorites")
            .WithSummary("Обрані товари покупця (лише видимі), від нещодавно доданих");

        group.MapGet("/ids", ListFavoriteIds.HandleAsync)
            .WithName("AccountListFavoriteIds")
            .WithSummary("Ідентифікатори обраних видимих товарів — для сердечок на картках");

        group.MapPut("/{productId:guid}", AddFavorite.HandleAsync)
            .WithName("AccountAddFavorite")
            .WithSummary("Додати товар до обраного (до 200); повторне додавання нічого не змінює")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapDelete("/{productId:guid}", RemoveFavorite.HandleAsync)
            .WithName("AccountRemoveFavorite")
            .WithSummary("Прибрати товар з обраного");

        return api;
    }
}
