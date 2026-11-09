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
        services.AddOptions<NavkoloOptions>().Bind(section)
            .Validate(o => o.Mode is NavkoloModes.Disabled or NavkoloModes.Stub or NavkoloModes.DnTrade, "Unknown Navkolo mode.")
            .Validate(o => o.Mode != NavkoloModes.DnTrade || !string.IsNullOrWhiteSpace(o.ApiKey), "Navkolo ApiKey is required for DNTrade.")
            .Validate(o => o.StoreId is null or "" || Guid.TryParse(o.StoreId, out _), "Navkolo StoreId must be a UUID.")
            .Validate(o => o.ApiKey.Length <= 2048 && !o.ApiKey.Any(char.IsControl), "Invalid Navkolo API key format.")
            .ValidateOnStart();
        services.AddSingleton<DnTradeRequestGate>();
        services.AddHttpClient("DNTrade", client =>
        {
            client.BaseAddress = new Uri("https://api.dntrade.com.ua/");
            client.Timeout = TimeSpan.FromSeconds(30);
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false })
            .RedactLoggedHeaders(["ApiKey"]);
        services.AddSingleton<StubNavkoloClient>();
        services.AddScoped<NavkoloClientFactory>();
        services.AddScoped<NavkoloSettings>();
        services.AddScoped<INavkoloClient, ConfiguredNavkoloClient>();
        services.AddScoped<INavkoloSettings>(sp => sp.GetRequiredService<NavkoloSettings>());
        services.AddScoped<NavkoloOrderGate>();
        services.AddScoped<Features.OrderSync.NavkoloInventorySync>();
        services.AddOutboxHandler<OrderExportRequested, ExportOrderToNavkolo>();
        services.AddOutboxHandler<OrderCancellationRequested, CancelOrderInNavkolo>();

        services.Replace(ServiceDescriptor.Scoped<ICatalogFreshness, NavkoloFreshness>());

        return services;
    }

    public static IServiceCollection AddNavkoloJobs(this IServiceCollection services) =>
        services
            .AddHostedService<NavkoloPriceStockJob>()
            .AddHostedService<NavkoloCatalogJob>();

    public static RouteGroupBuilder MapConsoleNavkoloSettingsEndpoints(this RouteGroupBuilder console) => NavkoloSettingsEndpoints.Map(console);

    public static RouteGroupBuilder MapConsoleCatalogImportEndpoints(this RouteGroupBuilder console) =>
        CatalogImportEndpoints.Map(console);
}
