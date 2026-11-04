using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace PoliValko.Customers.Features.Addresses;

internal static class AddressEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder account)
    {
        account.MapGet("/addresses", ListAddresses.HandleAsync)
            .WithName("AccountListAddresses")
            .WithSummary("Збережені адреси доставки покупця; основна — першою");

        account.MapPost("/addresses", CreateAddress.HandleAsync)
            .WithName("AccountCreateAddress")
            .WithSummary("Нова адреса доставки Нової пошти (до 10); перша адреса стає основною")
            .ProducesProblem(StatusCodes.Status409Conflict);

        account.MapPut("/addresses/{id:guid}", UpdateAddress.HandleAsync)
            .WithName("AccountUpdateAddress")
            .WithSummary("Зміна адреси доставки; isDefault=true робить її основною")
            .ProducesProblem(StatusCodes.Status404NotFound);

        account.MapDelete("/addresses/{id:guid}", DeleteAddress.HandleAsync)
            .WithName("AccountDeleteAddress")
            .WithSummary("Видалення адреси; якщо вона була основною, основною стає найстаріша з решти")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return account;
    }
}
