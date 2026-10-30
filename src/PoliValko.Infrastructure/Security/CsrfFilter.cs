using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Infrastructure.Security;

/// <summary>
/// Перевірка antiforgery-токена для змінних методів адмінки. Токен клієнт отримує з
/// <c>GET /api/v1/admin/auth/csrf</c> і передає в заголовку <c>X-CSRF-TOKEN</c>.
/// </summary>
internal sealed class CsrfFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        if (HttpMethods.IsGet(http.Request.Method) || HttpMethods.IsHead(http.Request.Method) || HttpMethods.IsOptions(http.Request.Method))
        {
            return await next(context);
        }

        var antiforgery = http.RequestServices.GetRequiredService<IAntiforgery>();
        if (!await antiforgery.IsRequestValidAsync(http))
        {
            return Problems.Create(
                StatusCodes.Status400BadRequest,
                "auth.csrf_invalid",
                "Сесію не підтверджено",
                "Оновіть сторінку: потрібен свіжий токен X-CSRF-TOKEN.");
        }

        return await next(context);
    }
}

public static class CsrfHeaders
{
    public const string Token = "X-CSRF-TOKEN";
}

public static class StaffEndpointExtensions
{
    /// <summary>Група адмінки: лише для працівників, змінні методи — з перевіркою CSRF.</summary>
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
