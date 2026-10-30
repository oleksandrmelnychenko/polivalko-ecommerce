using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace PoliValko.Infrastructure.Web;

/// <summary>
/// Помилки API у форматі RFC 9457 Problem Details. Кожна має машинозчитуваний <c>code</c>
/// і <c>traceId</c>, але ніколи не містить стек-трейсів чи внутрішніх повідомлень.
/// </summary>
public static class Problems
{
    public static ProblemHttpResult Create(
        int status,
        string code,
        string title,
        string? detail = null,
        IEnumerable<KeyValuePair<string, object?>>? extensions = null)
    {
        var all = new Dictionary<string, object?>(extensions ?? []) { ["code"] = code };
        return TypedResults.Problem(detail, statusCode: status, title: title, type: TypeFor(code), extensions: all);
    }

    public static ProblemHttpResult NotFound(string code, string title, string? detail = null) =>
        Create(StatusCodes.Status404NotFound, code, title, detail);

    public static string TypeFor(string code) => $"urn:polivalko:problem:{code}";

    public static IServiceCollection AddApiProblemDetails(this IServiceCollection services)
    {
        // Некоректне тіло чи параметри завжди йдуть через BadRequestExceptionHandler,
        // щоб клієнт отримав 400 у тому ж форматі в усіх середовищах.
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

internal sealed class BadRequestExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not BadHttpRequestException badRequest)
        {
            return false;
        }

        httpContext.Response.StatusCode = badRequest.StatusCode;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails =
            {
                Status = badRequest.StatusCode,
                Type = Problems.TypeFor("request.invalid"),
                Title = "Некоректний запит",
                Detail = "Тіло або параметри запиту не відповідають формату API.",
                Extensions = { ["code"] = "request.invalid" },
            },
        });
    }
}
