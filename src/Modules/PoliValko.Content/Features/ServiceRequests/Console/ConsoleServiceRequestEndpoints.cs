using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.ServiceRequests.Console;

internal static class ConsoleServiceRequestEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/service-requests").WithTags("Console").RequireStaff(PermissionKeys.RequestsView);

        group.MapGet(string.Empty, ListServiceRequests.HandleAsync)
            .WithName("ConsoleListServiceRequests")
            .WithEnumQuery<ServiceRequestStatus>("status")
            .WithSummary("Заявки на послуги");

        group.MapPost("/{id:guid}/status", ChangeServiceRequestStatus.HandleAsync)
            .RequirePermission(PermissionKeys.RequestsStatusChange)
            .WithName("ConsoleChangeServiceRequestStatus")
            .WithSummary("Статус заявки: нова, в роботі, виконана")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return console;
    }
}
