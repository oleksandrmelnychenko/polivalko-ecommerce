using Microsoft.Extensions.Options;
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

        // Allow HEAD checks on media endpoints (both local static files and DB-backed MapGet handlers in production)
        // so crawlers and validators receive 200 OK with Cache-Control / Content-Type / Content-Length instead of 405.
        var mediaPath = app.Services.GetRequiredService<IOptions<MediaOptions>>().Value.PublicPath.TrimEnd('/');
        app.Use(async (context, next) =>
        {
            if (HttpMethods.IsHead(context.Request.Method) && context.Request.Path.StartsWithSegments(mediaPath))
            {
                context.Request.Method = HttpMethods.Get;
                var originalBody = context.Response.Body;
                context.Response.Body = Stream.Null;
                try
                {
                    await next(context);
                }
                finally
                {
                    context.Request.Method = HttpMethods.Head;
                    context.Response.Body = originalBody;
                }

                return;
            }

            await next(context);
        });

        app.UseMediaFiles();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();
        return app;
    }
}
