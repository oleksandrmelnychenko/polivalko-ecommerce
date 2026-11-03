using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace PoliValko.Infrastructure.Media;

public static class MediaEndpointExtensions
{
    public static WebApplication UseMediaFiles(this WebApplication app)
    {
        var settings = app.Services.GetRequiredService<IOptions<MediaOptions>>().Value;
        var root = LocalMediaStorage.RootPath(settings, app.Environment);
        Directory.CreateDirectory(root);
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(root),
            RequestPath = settings.PublicPath.TrimEnd('/'),
            OnPrepareResponse = context =>
                context.Context.Response.Headers[HeaderNames.CacheControl] = "public, max-age=31536000, immutable",
        });
        return app;
    }
}
