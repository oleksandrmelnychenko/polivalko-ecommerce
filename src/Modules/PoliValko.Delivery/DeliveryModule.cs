using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PoliValko.Delivery.Configuration;
using PoliValko.Delivery.Contracts;
using PoliValko.Delivery.Features.Console;
using PoliValko.Delivery.Features.Directory;
using PoliValko.Delivery.Features.DirectorySync;
using PoliValko.Delivery.Features.Storefront;
using PoliValko.Delivery.Integrations.NovaPoshta;
using PoliValko.Delivery.Jobs;
using PoliValko.Delivery.Persistence;
using PoliValko.Infrastructure;

namespace PoliValko.Delivery;

public static class DeliveryModule
{
    public static IServiceCollection AddDeliveryModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<NovaPoshtaOptions>().BindConfiguration(NovaPoshtaOptions.Section);
        services.AddMemoryCache();
        services.AddModelConfigurator<DeliveryModelConfigurator>();

        services.AddScoped<PickupPointStore>();
        services.AddScoped<DemoNovaPoshtaDirectory>();
        services.AddScoped<NovaPoshtaDbDirectory>();

        services.AddScoped<IDeliveryDirectory>(provider =>
            provider.GetRequiredService<IOptions<NovaPoshtaOptions>>().Value.IsConfigured
                ? provider.GetRequiredService<NovaPoshtaDbDirectory>()
                : provider.GetRequiredService<DemoNovaPoshtaDirectory>());

        services.AddHttpClient<NovaPoshtaClient>((provider, http) =>
        {
            var options = provider.GetRequiredService<IOptions<NovaPoshtaOptions>>().Value;
            http.BaseAddress = new Uri(options.BaseUrl);
            http.Timeout = options.Timeout;
        });
        services.AddScoped<NovaPoshtaDirectorySync>();
        return services;
    }

    public static IServiceCollection AddDeliveryJobs(this IServiceCollection services)
    {
        services.AddHostedService<NovaPoshtaSyncJob>();
        return services;
    }

    public static IEndpointRouteBuilder MapDeliveryEndpoints(this IEndpointRouteBuilder api) =>
        DeliveryEndpoints.Map(api);

    public static RouteGroupBuilder MapConsoleDeliveryEndpoints(this RouteGroupBuilder console)
    {
        ConsoleDeliveryEndpoints.Map(console);
        return console;
    }
}
