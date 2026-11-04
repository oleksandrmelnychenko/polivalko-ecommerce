using System.Text.Json;
using System.Text.Json.Serialization;
using PoliValko.Console;
using PoliValko.Catalog;
using PoliValko.Content;
using PoliValko.Delivery;
using PoliValko.Fiscal;
using PoliValko.Identity;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.Navkolo;
using PoliValko.Notifications;
using PoliValko.Ordering;
using PoliValko.Payments;

namespace PoliValko.Api.Composition;

public static class ApiServices
{
    public static IServiceCollection AddPoliValkoApi(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddPlatform()
            .AddCatalogModule(configuration)
            .AddContentModule(configuration)
            .AddDeliveryModule(configuration)
            .AddOrderingModule(configuration)
            .AddPaymentsModule(configuration)
            .AddFiscalModule(configuration)
            .AddNavkoloModule(configuration)
            .AddIdentityModule(configuration)
            .AddNotificationsModule(configuration)
            .AddConsoleModule(configuration);

        services.AddApiProblemDetails();
        services.AddApiRateLimiting();
        services.AddApiCors(configuration);
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        });
        services.AddOpenApi("v1", options => options.AddDocumentTransformer((document, _, _) =>
        {
            document.Info ??= new();
            document.Info.Title = "Poli Valko API";
            document.Info.Version = "v1";
            document.Info.Description = "Спільний API інтернет-магазину Poli Valko для вебу та майбутніх мобільних застосунків.";
            return Task.CompletedTask;
        }));
        services.AddHealthChecks().AddDbContextCheck<PoliValkoDbContext>("database", tags: ["ready"]);
        return services;
    }
}
