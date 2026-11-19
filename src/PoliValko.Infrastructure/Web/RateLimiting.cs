using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace PoliValko.Infrastructure.Web;

public static class RateLimitPolicies
{
    public const string Cart = "cart";
    public const string Forms = "forms";
    public const string Orders = "orders";
    public const string Login = "login";
    public const string DnTradeArchiveImport = "dntrade-archive-import";
}

public static class RateLimitingRegistration
{
    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(_ => { });
        services.AddOptions<RateLimiterOptions>().Configure<IConfiguration>((options, configuration) =>
        {
            AddPerIpPolicy(options, configuration, RateLimitPolicies.Cart, "RateLimiting:Cart", 120);
            AddPerIpPolicy(options, configuration, RateLimitPolicies.Forms, "RateLimiting:Forms", 5);
            AddPerIpPolicy(options, configuration, RateLimitPolicies.Orders, "RateLimiting:Orders", 10, defaultWindowSeconds: 600);
            AddPerIpPolicy(options, configuration, RateLimitPolicies.Login, "RateLimiting:Login", 10);
            AddArchiveImportPolicy(options, configuration);

            options.OnRejected = async (context, _) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                }

                await context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = context.HttpContext,
                    ProblemDetails = { Status = StatusCodes.Status429TooManyRequests, Title = "Забагато запитів", Detail = "Спробуйте трохи пізніше." },
                });
            };
        });
        return services;
    }

    private static void AddArchiveImportPolicy(RateLimiterOptions options, IConfiguration configuration)
    {
        var settings = configuration.GetSection("RateLimiting:DnTradeArchiveImport");
        var burstLimit = settings.GetValue("BurstLimit", 3);
        var interval = TimeSpan.FromSeconds(settings.GetValue("ReplenishmentSeconds", 2));

        options.AddPolicy(RateLimitPolicies.DnTradeArchiveImport, http =>
            RateLimitPartition.GetTokenBucketLimiter(
                http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = burstLimit,
                    TokensPerPeriod = 1,
                    ReplenishmentPeriod = interval,
                    AutoReplenishment = true,
                }));
    }

    private static void AddPerIpPolicy(RateLimiterOptions options, IConfiguration configuration, string policy, string section, int defaultLimit, int defaultWindowSeconds = 60)
    {
        var settings = configuration.GetSection(section);
        var permitLimit = settings.GetValue("PermitLimit", defaultLimit);
        var window = TimeSpan.FromSeconds(settings.GetValue("WindowSeconds", defaultWindowSeconds));

        options.AddPolicy(policy, http =>
            RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = permitLimit, Window = window }));
    }
}
