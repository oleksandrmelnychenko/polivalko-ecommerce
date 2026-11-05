using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Infrastructure.Security;

public static class StaffEndpointExtensions
{
    public static RouteGroupBuilder RequireStaff(this RouteGroupBuilder group, params string[] anyOf)
    {
        group.RequireAuthorization(anyOf.Length == 0 ? StaffPolicies.Staff : PermissionRequirement.PolicyName(anyOf));
        group.AddEndpointFilter<CsrfFilter>();
        group.ProducesProblem(StatusCodes.Status401Unauthorized);
        group.ProducesProblem(StatusCodes.Status403Forbidden);
        return group;
    }

    public static RouteHandlerBuilder RequirePermission(this RouteHandlerBuilder builder, params string[] anyOf) =>
        builder
            .RequireAuthorization(PermissionRequirement.PolicyName(anyOf))
            .ProducesProblem(StatusCodes.Status403Forbidden);

    public static RouteHandlerBuilder RequireCsrf(this RouteHandlerBuilder builder) =>
        builder.AddEndpointFilter<CsrfFilter>();

    public static RouteGroupBuilder RequireCsrf(this RouteGroupBuilder group)
    {
        group.AddEndpointFilter<CsrfFilter>();
        return group;
    }
}
