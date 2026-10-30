using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure;

namespace PoliValko.Catalog;

public static class CatalogModule
{
    public static IServiceCollection AddCatalogModule(this IServiceCollection services)
    {
        services.AddOptions<CatalogOptions>().BindConfiguration("Catalog");
        return services
            .AddModelConfigurator<CatalogModelConfigurator>()
            .AddScoped<ICatalogPricing, CatalogPricing>()
            .AddScoped<ICatalogImporter, CatalogImporter>()
            // Без синхронізації з Navkolo дані вважаються свіжими; модуль Navkolo замінює реалізацію.
            .AddScoped<ICatalogFreshness, AlwaysFreshCatalog>();
    }
}
