using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Api.Composition;

public static class ApiPipeline
{
    public static WebApplication UsePoliValkoPipeline(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path;
            if (path.StartsWithSegments("/api/v1/account") ||
                path.StartsWithSegments("/api/v1/cart") ||
                path.StartsWithSegments("/api/v1/orders") ||
                path.StartsWithSegments("/api/v1/payments/sandbox"))
            {
                context.Response.Headers.CacheControl = "private, no-store";
            }

            if (context.Request.QueryString.Value is { } query && query.Contains("%00", StringComparison.Ordinal))
            {
                await Problems.Create(StatusCodes.Status400BadRequest, "http.bad_query", "Некоректний запит", "Параметри містять недопустимий символ.")
                    .ExecuteAsync(context);
                return;
            }

            await next(context);
        });
        app.UseCors();
        app.UseMediaFiles();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();
        return app;
    }
}
