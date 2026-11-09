using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Configuration;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Features.Console;
using PoliValko.Catalog.Features.Favorites;
using PoliValko.Catalog.Features.Import;
using PoliValko.Catalog.Features.Pricing;
using PoliValko.Catalog.Features.Reporting;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Catalog.Persistence;
using PoliValko.Customers.Contracts;
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
            .AddScoped<ICatalogReservations, CatalogReservations>()
            .AddOutboxHandler<StockAvailabilityChanged, InvalidateStockAvailability>()
            .AddScoped<ICatalogImporter, CatalogImporter>()
            .AddScoped<ICatalogReporting, CatalogReporting>()
            .AddSingleton<ICatalogDemoFeed, CatalogDemoFeed>()
            .AddScoped<ICatalogFreshness, AlwaysFreshCatalog>()
            .AddScoped<ICustomerFavoritesCounter, CustomerFavoritesCounter>();
    }

    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder api) =>
        CatalogEndpoints.Map(api);

    public static RouteGroupBuilder MapConsoleCatalogEndpoints(this RouteGroupBuilder console) =>
        ConsoleCatalogEndpoints.Map(console);

    public static IEndpointRouteBuilder MapAccountFavoriteEndpoints(this IEndpointRouteBuilder api) =>
        FavoriteEndpoints.Map(api);

    public static Task SeedDemoDataAsync(IServiceProvider services, CancellationToken ct = default) =>
        CatalogDemoData.SeedAsync(services.GetRequiredService<PoliValkoDbContext>(), services.GetRequiredService<TimeProvider>(), ct);

    public static Task SyncDictionariesAsync(IServiceProvider services, CancellationToken ct = default) =>
        CatalogDictionarySync.SyncAsync(services.GetRequiredService<PoliValkoDbContext>(), ct);
}
