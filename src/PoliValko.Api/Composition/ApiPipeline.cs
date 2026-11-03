using PoliValko.Infrastructure.Media;

namespace PoliValko.Api.Composition;

public static class ApiPipeline
{
    public static WebApplication UsePoliValkoPipeline(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        app.UseCors();
        app.UseMediaFiles();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();
        return app;
    }
}
