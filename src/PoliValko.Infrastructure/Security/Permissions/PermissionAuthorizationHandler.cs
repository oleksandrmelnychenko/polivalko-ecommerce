using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace PoliValko.Infrastructure.Security.Permissions;

public sealed partial class PermissionAuthorizationHandler(
    IStaffAccessResolver resolver,
    IHttpContextAccessor http,
    ILogger<PermissionAuthorizationHandler> logger)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var httpContext = http.HttpContext;
        var access = await resolver.GetStaffAccessAsync(context.User, httpContext?.Items, httpContext?.RequestAborted ?? default);
        if (access is not null && access.HasAny(requirement.AnyOf))
        {
            context.Succeed(requirement);
            return;
        }

        LogDenied(logger, string.Join(" | ", requirement.AnyOf), httpContext?.Request.Method ?? "?", httpContext?.Request.Path.Value ?? "?");
    }

    [LoggerMessage(EventId = 4601, Level = LogLevel.Warning, Message = "Немає права {Permission} для {Method} {Path}")]
    private static partial void LogDenied(ILogger logger, string permission, string method, string path);
}
