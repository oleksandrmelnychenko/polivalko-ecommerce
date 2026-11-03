using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace PoliValko.Infrastructure.Web;

public static class ProblemDetailsRegistration
{
    public static IServiceCollection AddApiProblemDetails(this IServiceCollection services)
    {
        services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
        services.AddExceptionHandler<BadRequestExceptionHandler>();

        return services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
        {
            var problem = context.ProblemDetails;
            problem.Extensions.TryAdd("traceId", Activity.Current?.Id ?? context.HttpContext.TraceIdentifier);

            if (!problem.Extensions.ContainsKey("code"))
            {
                var (code, title) = problem switch
                {
                    HttpValidationProblemDetails => ("validation.failed", "Перевірте введені дані"),
                    _ => problem.Status switch
                    {
                        StatusCodes.Status404NotFound => ("http.not_found", "Не знайдено"),
                        StatusCodes.Status405MethodNotAllowed => ("http.method_not_allowed", "Метод не підтримується"),
                        StatusCodes.Status429TooManyRequests => ("http.too_many_requests", "Забагато запитів"),
                        >= 500 => ("server.error", "Внутрішня помилка сервера"),
                        _ => ("http.error", problem.Title ?? "Помилка запиту"),
                    },
                };
                problem.Extensions["code"] = code;
                problem.Title = title;
            }

            if (problem.Status >= 500)
            {
                problem.Title = "Внутрішня помилка сервера";
                problem.Detail = null;
            }
        });
    }
}
