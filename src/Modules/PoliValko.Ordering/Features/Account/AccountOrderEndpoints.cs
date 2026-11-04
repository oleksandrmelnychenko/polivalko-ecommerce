using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Customers.Contracts;

namespace PoliValko.Ordering.Features.Account;

internal static class AccountOrderEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/account/orders").WithTags("Account").RequireCustomer();

        group.MapGet(string.Empty, ListAccountOrders.HandleAsync)
            .WithName("AccountListOrders")
            .WithSummary("Замовлення покупця, від нових до старих");

        group.MapGet("/{number}", GetAccountOrder.HandleAsync)
            .WithName("AccountGetOrder")
            .WithSummary("Замовлення покупця: статус, оплата, доставка, позиції. Чужі замовлення — 404")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return api;
    }
}
