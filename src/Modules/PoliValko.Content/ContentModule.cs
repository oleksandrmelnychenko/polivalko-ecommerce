using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Content.Contracts;
using PoliValko.Content.Features.ServiceRequests;
using PoliValko.Content.Features.ServiceRequests.Admin;
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

    public static RouteGroupBuilder MapAdminSiteContentEndpoints(this RouteGroupBuilder admin) =>
        AdminSiteContentEndpoints.Map(admin);

    public static RouteGroupBuilder MapAdminServiceRequestEndpoints(this RouteGroupBuilder admin) =>
        AdminServiceRequestEndpoints.Map(admin);
}
