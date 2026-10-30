using Microsoft.Extensions.DependencyInjection;
using PoliValko.Content.Persistence;
using PoliValko.Infrastructure;

namespace PoliValko.Content;

public static class ContentModule
{
    public static IServiceCollection AddContentModule(this IServiceCollection services) =>
        services
            .AddModelConfigurator<ContentModelConfigurator>()
            .AddOutboxHandler<ServiceRequestSubmitted, NotifyManagerOnServiceRequest>();
}
