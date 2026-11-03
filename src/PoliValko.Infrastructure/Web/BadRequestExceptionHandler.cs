using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;

namespace PoliValko.Infrastructure.Web;

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
