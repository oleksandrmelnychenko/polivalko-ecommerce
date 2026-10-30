using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PoliValko.Catalog;
using PoliValko.Infrastructure;
using PoliValko.Ordering;

namespace PoliValko.Navkolo;

public static class NavkoloModule
{
    /// <summary>
    /// Інтеграція з Navkolo (розділ 7 ТЗ). Доки немає документації API, працює заглушка клієнта;
    /// у режимі <c>Disabled</c> синхронізації немає, а дані каталогу вважаються підтвердженими.
    /// </summary>
    public static IServiceCollection AddNavkoloModule(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Navkolo");
        services.Configure<NavkoloOptions>(section);
        services.AddSingleton<INavkoloClient, StubNavkoloClient>();
        services.AddOutboxHandler<OrderExportRequested, ExportOrderToNavkolo>();

        if (section.Get<NavkoloOptions>()?.IsEnabled == true)
        {
            services.Replace(ServiceDescriptor.Scoped<ICatalogFreshness, NavkoloFreshness>());
        }

        return services;
    }

    /// <summary>Синхронізація цін, залишків і каталогу. Лише в хості Worker.</summary>
    public static IServiceCollection AddNavkoloJobs(this IServiceCollection services) =>
        services
            .AddHostedService<NavkoloPriceStockJob>()
            .AddHostedService<NavkoloCatalogJob>();
}
