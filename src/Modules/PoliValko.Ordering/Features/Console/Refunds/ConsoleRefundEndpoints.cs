using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Ordering.Features.Console.Refunds;

internal static class ConsoleRefundEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        console.MapGroup("/refunds").WithTags("Console").RequireStaff(PermissionKeys.OrdersView)
            .MapGet(string.Empty, ListRefunds.HandleAsync)
            .WithName("ConsoleListRefunds")
            .WithEnumQuery<RefundStatus>("status")
            .WithSummary("Повернення коштів з усіх замовлень: пошук за номером чи телефоном, фільтр за статусом і датами, стан чека");
        return console;
    }
}
