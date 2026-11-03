using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace PoliValko.Infrastructure.Web;

public static class CorsRegistration
{
    public static IServiceCollection AddApiCors(this IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
        services.AddCors(options => options.AddDefaultPolicy(policy =>
        {
            if (origins.Length > 0)
            {
                policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
            }
        }));
        return services;
    }
}
