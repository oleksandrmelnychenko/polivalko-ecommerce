using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Delivery.Features.Settings;

internal static class DeliverySettingsEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var settings = console.MapGroup("/settings/delivery").WithTags("Console").RequireStaff(PermissionKeys.PickupManage);

        settings.MapGet(string.Empty, GetDeliverySettings.HandleAsync)
            .WithName("ConsoleGetDeliverySettings")
            .WithSummary("Способи доставки: Нова пошта (і післяплата), кур'єр, самовивіз");
        settings.MapPut(string.Empty, SaveDeliverySettings.HandleAsync)
            .WithName("ConsoleSaveDeliverySettings")
            .WithSummary("Увімкнення способів доставки; самовивіз покупець бачить, лише коли є активна точка")
            .ProducesProblem(StatusCodes.Status400BadRequest);

        return console;
    }
}
