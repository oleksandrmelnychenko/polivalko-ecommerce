using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Payments.Features.Admin;

internal static class AdminPaymentEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        admin.MapGroup("/orders").WithTags("Admin").RequireStaff()
            .MapGet("/{number}/payments", ListOrderPayments.HandleAsync)
            .WithName("AdminListOrderPayments")
            .WithSummary("Спроби онлайн-оплати замовлення та отримані повідомлення провайдера");
        return admin;
    }
}
