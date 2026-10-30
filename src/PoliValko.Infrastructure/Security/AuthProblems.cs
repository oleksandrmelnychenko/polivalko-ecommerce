using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Infrastructure.Security;

/// <summary>API відповідає на відсутність входу чи прав у форматі Problem Details, а не редиректом.</summary>
public static class AuthProblems
{
    public static Task WriteUnauthorizedAsync(HttpContext http) =>
        WriteAsync(http, StatusCodes.Status401Unauthorized, "auth.unauthorized", "Потрібен вхід", "Увійдіть до адмінки.");

    public static Task WriteForbiddenAsync(HttpContext http) =>
        WriteAsync(http, StatusCodes.Status403Forbidden, "auth.forbidden", "Недостатньо прав", "Ця дія доступна лише адміністратору.");

    private static async Task WriteAsync(HttpContext http, int status, string code, string title, string detail)
    {
        http.Response.StatusCode = status;
        await http.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails =
            {
                Status = status,
                Type = Problems.TypeFor(code),
                Title = title,
                Detail = detail,
                Extensions = { ["code"] = code },
            },
        });
    }
}
