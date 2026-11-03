using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Auth;

internal static class AuthEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        var auth = admin.MapGroup("/auth").WithTags("Admin");

        auth.MapPost("/login", Login.HandleAsync)
            .RequireRateLimiting(RateLimitPolicies.Login)
            .WithName("AdminLogin")
            .WithSummary("Вхід працівника; встановлює cookie pv_admin")
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        auth.MapPost("/logout", Logout.HandleAsync)
            .RequireAuthorization(StaffPolicies.Staff)
            .RequireCsrf()
            .WithName("AdminLogout")
            .WithSummary("Вихід");

        auth.MapGet("/me", Me.Handle)
            .RequireAuthorization(StaffPolicies.Staff)
            .WithName("AdminMe")
            .WithSummary("Поточний працівник і його ролі")
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        auth.MapGet("/csrf", GetCsrfToken.Handle)
            .WithName("AdminCsrf")
            .WithSummary("Токен для заголовка X-CSRF-TOKEN; отримуйте після входу");

        return admin;
    }
}
