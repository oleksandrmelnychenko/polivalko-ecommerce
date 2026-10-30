using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Persistence;
using PoliValko.Content.Api;
using PoliValko.Identity;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Api;

internal static class ApiSetup
{
    /// <summary>
    /// Обмеження частоти для форм і входу в адмінку (захист від спаму й перебору, розділ 10 ТЗ).
    /// За reverse proxy IP клієнта береться з X-Forwarded-For (ASPNETCORE_FORWARDEDHEADERS_ENABLED=true).
    /// </summary>
    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(_ => { });
        services.AddOptions<RateLimiterOptions>().Configure<IConfiguration>((options, configuration) =>
        {
            AddPerIpPolicy(options, configuration, ServiceRequestEndpoints.FormsRateLimitPolicy, "RateLimiting:Forms", 5);
            AddPerIpPolicy(options, configuration, IdentityModule.LoginRateLimitPolicy, "RateLimiting:Login", 10);

            options.OnRejected = async (context, _) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = context.HttpContext,
                    ProblemDetails = { Status = StatusCodes.Status429TooManyRequests, Title = "Забагато запитів", Detail = "Спробуйте трохи пізніше." },
                });
            };
        });
        return services;
    }

    /// <summary>
    /// CORS лише для погоджених джерел із <c>Cors:Origins</c> (розділ 2 ТЗ). Вітрина й адмінка
    /// працюють з того самого origin через reverse proxy, тож за замовчуванням список порожній.
    /// </summary>
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

    private static void AddPerIpPolicy(RateLimiterOptions options, IConfiguration configuration, string policy, string section, int defaultLimit)
    {
        var settings = configuration.GetSection(section);
        var permitLimit = settings.GetValue("PermitLimit", defaultLimit);
        var window = TimeSpan.FromSeconds(settings.GetValue("WindowSeconds", 60));

        options.AddPolicy(policy, http =>
            RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = permitLimit, Window = window }));
    }

    /// <summary>
    /// Лише для локальної розробки. На staging і production міграції застосовує окремий
    /// крок розгортання (EF migrations bundle, сервіс <c>migrate</c> у compose.yaml).
    /// </summary>
    public static async Task PrepareDatabaseAsync(this WebApplication app)
    {
        var migrate = app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup");
        var seed = app.Configuration.GetValue<bool>("Database:SeedDemoData");
        var seedUsers = app.Configuration.GetSection("Seed:Users").Exists();
        if (!migrate && !seed && !seedUsers)
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<PoliValkoDbContext>();
        if (migrate)
        {
            await db.Database.MigrateAsync();
        }

        // Схему створює окремий крок міграцій; доки він не завершився, наповнювати нічого.
        if ((await db.Database.GetPendingMigrationsAsync()).Any())
        {
            app.Logger.LogWarning("БД ще не мігрована: демо-дані й працівники з Seed:Users не створені");
            return;
        }

        if (seed)
        {
            await CatalogDemoData.SeedAsync(db, scope.ServiceProvider.GetRequiredService<TimeProvider>());
        }

        // Ролі й перший адміністратор (Seed:Users) — і на production: наявних працівників не змінює.
        await IdentitySeeder.SeedAsync(app.Services);
    }
}
