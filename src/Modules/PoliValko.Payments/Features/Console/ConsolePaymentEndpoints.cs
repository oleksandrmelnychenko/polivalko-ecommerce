using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Payments.Features.Console;

internal static class ConsolePaymentEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        console.MapGroup("/orders").WithTags("Console").RequireStaff()
            .MapGet("/{number}/payments", ListOrderPayments.HandleAsync)
            .WithName("ConsoleListOrderPayments")
            .WithSummary("Спроби онлайн-оплати замовлення та отримані повідомлення провайдера");
        return console;
    }
}
