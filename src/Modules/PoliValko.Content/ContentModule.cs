using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Content.Contracts;
using PoliValko.Content.Features.ServiceRequests;
using PoliValko.Content.Features.ServiceRequests.Console;
using PoliValko.Content.Features.SiteContent;
using PoliValko.Content.Persistence;
using PoliValko.Infrastructure;

namespace PoliValko.Content;

public static class ContentModule
{
    public static IServiceCollection AddContentModule(this IServiceCollection services, IConfiguration configuration) =>
        services
            .AddModelConfigurator<ContentModelConfigurator>()
            .AddScoped<IServiceRequestStats, ServiceRequestStats>()
            .AddOutboxHandler<ServiceRequestSubmitted, NotifyManagerOnServiceRequest>();

    public static IEndpointRouteBuilder MapServiceRequestEndpoints(this IEndpointRouteBuilder api) =>
        ServiceRequestEndpoints.Map(api);

    public static IEndpointRouteBuilder MapSiteContentEndpoints(this IEndpointRouteBuilder api) =>
        SiteContentEndpoints.Map(api);

    public static RouteGroupBuilder MapConsoleSiteContentEndpoints(this RouteGroupBuilder console) =>
        ConsoleSiteContentEndpoints.Map(console);

    public static RouteGroupBuilder MapConsoleServiceRequestEndpoints(this RouteGroupBuilder console) =>
        ConsoleServiceRequestEndpoints.Map(console);
}
