using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Delivery.Features.Admin;

internal static class AdminDeliveryEndpoints
{
    public static void Map(RouteGroupBuilder admin)
    {
        var group = admin.MapGroup("/delivery").WithTags("Admin").RequireStaff(StaffPolicies.Admin);

        group.MapGet("/pickup-points", ListPickupPoints.HandleAsync)
            .WithName("AdminListPickupPoints")
            .WithSummary("Точки самовивозу, разом із вимкненими");

        group.MapPut("/pickup-points/{code}", UpdatePickupPoint.HandleAsync)
            .WithName("AdminUpdatePickupPoint")
            .WithSummary("Змінити точку самовивозу: адреса, графік роботи, інструкція покупцю")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/novaposhta", GetNovaPoshtaStatus.HandleAsync)
            .WithName("AdminGetNovaPoshtaStatus")
            .WithSummary("Довідник Нової пошти: режим, кількість записів і стан синхронізації");
    }
}
