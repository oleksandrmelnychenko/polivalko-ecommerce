using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.ServiceRequests.Admin;

internal static class AdminServiceRequestEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        var group = admin.MapGroup("/service-requests").WithTags("Admin").RequireStaff();

        group.MapGet(string.Empty, ListServiceRequests.HandleAsync)
            .WithName("AdminListServiceRequests")
            .WithEnumQuery<ServiceRequestStatus>("status")
            .WithSummary("Заявки на послуги");

        group.MapPost("/{id:guid}/status", ChangeServiceRequestStatus.HandleAsync)
            .WithName("AdminChangeServiceRequestStatus")
            .WithSummary("Статус заявки: нова, в роботі, виконана")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return admin;
    }
}
