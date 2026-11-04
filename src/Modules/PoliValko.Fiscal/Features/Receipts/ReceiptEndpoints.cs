using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

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
        console.MapGroup("/orders").WithTags("Console").RequireStaff()
            .MapGet("/{number}/receipts", ListOrderReceipts.HandleAsync)
            .WithName("ConsoleListOrderReceipts")
            .WithSummary("Фіскальні чеки продажу й повернення за замовленням");
        return console;
    }
}
