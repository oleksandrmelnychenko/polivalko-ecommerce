using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace PoliValko.Infrastructure.Security;

public static class StaffEndpointExtensions
{
    public static RouteGroupBuilder RequireStaff(this RouteGroupBuilder group, string policy = StaffPolicies.Staff)
    {
        group.RequireAuthorization(policy);
        group.AddEndpointFilter<CsrfFilter>();
        group.ProducesProblem(StatusCodes.Status401Unauthorized);
        group.ProducesProblem(StatusCodes.Status403Forbidden);
        return group;
    }

    public static RouteHandlerBuilder RequireCsrf(this RouteHandlerBuilder builder) =>
        builder.AddEndpointFilter<CsrfFilter>();
}
