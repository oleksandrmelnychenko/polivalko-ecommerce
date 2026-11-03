using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Configuration;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Features.Admin;
using PoliValko.Catalog.Features.Import;
using PoliValko.Catalog.Features.Pricing;
using PoliValko.Catalog.Features.Reporting;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog;

public static class CatalogModule
{
    public static IServiceCollection AddCatalogModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<CatalogOptions>().BindConfiguration("Catalog");
        return services
            .AddModelConfigurator<CatalogModelConfigurator>()
            .AddScoped<ICatalogPricing, CatalogPricing>()
            .AddScoped<ICatalogImporter, CatalogImporter>()
            .AddScoped<ICatalogReporting, CatalogReporting>()
            .AddSingleton<ICatalogDemoFeed, CatalogDemoFeed>()
            .AddScoped<ICatalogFreshness, AlwaysFreshCatalog>();
    }

    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder api) =>
        CatalogEndpoints.Map(api);

    public static RouteGroupBuilder MapAdminCatalogEndpoints(this RouteGroupBuilder admin) =>
        AdminCatalogEndpoints.Map(admin);

    public static Task SeedDemoDataAsync(IServiceProvider services, CancellationToken ct = default) =>
        CatalogDemoData.SeedAsync(services.GetRequiredService<PoliValkoDbContext>(), services.GetRequiredService<TimeProvider>(), ct);
}
