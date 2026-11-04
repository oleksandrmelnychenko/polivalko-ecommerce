using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Delivery.Features.Console;

internal static class ConsoleDeliveryEndpoints
{
    public static void Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/delivery").WithTags("Console").RequireStaff(StaffPolicies.Admin);

        group.MapGet("/pickup-points", ListPickupPoints.HandleAsync)
            .WithName("ConsoleListPickupPoints")
            .WithSummary("Точки самовивозу, разом із вимкненими");

        group.MapPut("/pickup-points/{code}", UpdatePickupPoint.HandleAsync)
            .WithName("ConsoleUpdatePickupPoint")
            .WithSummary("Змінити точку самовивозу: адреса, графік роботи, інструкція покупцю")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/novaposhta", GetNovaPoshtaStatus.HandleAsync)
            .WithName("ConsoleGetNovaPoshtaStatus")
            .WithSummary("Довідник Нової пошти: режим, кількість записів і стан синхронізації");
    }
}
