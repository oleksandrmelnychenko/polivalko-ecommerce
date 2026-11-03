using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Fiscal.Configuration;
using PoliValko.Fiscal.Features.Issuing;
using PoliValko.Fiscal.Features.Receipts;
using PoliValko.Fiscal.Integrations.Checkbox;
using PoliValko.Fiscal.Integrations.Providers;
using PoliValko.Fiscal.Integrations.Stub;
using PoliValko.Fiscal.Persistence;
using PoliValko.Infrastructure;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal;

public static class FiscalModule
{
    public static IServiceCollection AddFiscalModule(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Fiscal");
        services.Configure<FiscalOptions>(section);
        var provider = section.GetValue<string>("Provider");

        if (string.Equals(provider, "Checkbox", StringComparison.OrdinalIgnoreCase))
        {
            services.AddHttpClient<CheckboxFiscalProvider>(client => client.Timeout = TimeSpan.FromSeconds(30));
            services.AddScoped<IFiscalProvider>(sp => sp.GetRequiredService<CheckboxFiscalProvider>());
        }
        else if (string.Equals(provider, "Stub", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IFiscalProvider, StubFiscalProvider>();
        }

        return services
            .AddModelConfigurator<FiscalModelConfigurator>()
            .AddOutboxHandler<FiscalReceiptRequested, IssueReceiptOnRequest>();
    }

    public static IEndpointRouteBuilder MapReceiptEndpoints(this IEndpointRouteBuilder api) =>
        ReceiptEndpoints.Map(api);

    public static RouteGroupBuilder MapAdminReceiptEndpoints(this RouteGroupBuilder admin) =>
        ReceiptEndpoints.MapAdmin(admin);
}
