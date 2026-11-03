using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Infrastructure.Security;

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
