using PoliValko.Catalog;
using PoliValko.Content;
using PoliValko.Delivery;
using PoliValko.Fiscal;
using PoliValko.Infrastructure;
using PoliValko.Navkolo;
using PoliValko.Notifications;
using PoliValko.Ordering;
using PoliValko.Payments;

namespace PoliValko.Worker.Composition;

public static class WorkerServices
{
    public static IServiceCollection AddPoliValkoWorker(this IServiceCollection services, IConfiguration configuration) =>
        services
            .AddPlatform()
            .AddCatalogModule(configuration)
            .AddContentModule(configuration)
            .AddDeliveryModule(configuration)
            .AddOrderingModule(configuration)
            .AddPaymentsModule(configuration)
            .AddFiscalModule(configuration)
            .AddNavkoloModule(configuration)
            .AddNotificationsModule(configuration)
            .AddPlatformJobs()
            .AddDeliveryJobs()
            .AddPaymentsJobs()
            .AddNavkoloJobs();
}
