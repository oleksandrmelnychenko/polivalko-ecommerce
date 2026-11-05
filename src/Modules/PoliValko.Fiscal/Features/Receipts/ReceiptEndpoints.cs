using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Fiscal.Features.Receipts;

internal static class ReceiptEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/orders/{number}/receipts", GetOrderReceipts.HandleAsync)
            .WithTags("Checkout")
            .WithName("GetOrderReceipts")
            .WithSummary("Фіскальні чеки замовлення для покупця (за токеном)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        return api;
    }

    public static RouteGroupBuilder MapConsole(RouteGroupBuilder console)
    {
        console.MapGroup("/orders").WithTags("Console").RequireStaff(PermissionKeys.OrdersView)
            .MapGet("/{number}/receipts", ListOrderReceipts.HandleAsync)
            .WithName("ConsoleListOrderReceipts")
            .WithSummary("Фіскальні чеки продажу й повернення за замовленням");
        return console;
    }

    public static IEndpointRouteBuilder MapAccount(IEndpointRouteBuilder api)
    {
        api.MapGroup("/account/orders").WithTags("Account").RequireCustomer()
            .MapGet("/{number}/receipts", GetAccountOrderReceipts.HandleAsync)
            .WithName("AccountGetOrderReceipts")
            .WithSummary("Фіскальні чеки замовлення покупця. Чужі замовлення — 404")
            .ProducesProblem(StatusCodes.Status404NotFound);
        return api;
    }
}
