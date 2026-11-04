using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;
using PoliValko.Navkolo.Features.CatalogImport;
using PoliValko.Navkolo.Features.Freshness;
using PoliValko.Navkolo.Features.OrderExport;
using PoliValko.Navkolo.Features.Settings;
using PoliValko.Navkolo.Integrations.NavkoloApi;
using PoliValko.Navkolo.Jobs;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Navkolo;

public static class NavkoloModule
{
    public static IServiceCollection AddNavkoloModule(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Navkolo");
        services.Configure<NavkoloOptions>(section);
        services.AddSingleton<INavkoloClient, StubNavkoloClient>();
        services.AddSingleton<INavkoloSettings, NavkoloSettings>();
        services.AddOutboxHandler<OrderExportRequested, ExportOrderToNavkolo>();

        if (section.Get<NavkoloOptions>()?.IsEnabled == true)
        {
            services.Replace(ServiceDescriptor.Scoped<ICatalogFreshness, NavkoloFreshness>());
        }

        return services;
    }

    public static IServiceCollection AddNavkoloJobs(this IServiceCollection services) =>
        services
            .AddHostedService<NavkoloPriceStockJob>()
            .AddHostedService<NavkoloCatalogJob>();

    public static RouteGroupBuilder MapConsoleCatalogImportEndpoints(this RouteGroupBuilder console) =>
        CatalogImportEndpoints.Map(console);
}
