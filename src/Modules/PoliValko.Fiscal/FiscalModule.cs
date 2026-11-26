using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Fiscal.Configuration;
using PoliValko.Fiscal.Contracts;
using PoliValko.Fiscal.Features.Issuing;
using PoliValko.Fiscal.Features.Receipts;
using PoliValko.Fiscal.Features.Settings;
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
        // Checkbox is always registered: the console turns it on and off. The stub only where the server asks for it.
        services.AddHttpClient<CheckboxFiscalProvider>(client => client.Timeout = TimeSpan.FromSeconds(30));
        services.AddScoped<IFiscalProvider>(sp => sp.GetRequiredService<CheckboxFiscalProvider>());
        services.AddHttpClient(FiscalSettingsEndpoints.CheckClient, client => client.Timeout = TimeSpan.FromSeconds(20));
        if (string.Equals(section.GetValue<string>("Provider"), "Stub", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IFiscalProvider, StubFiscalProvider>();
        }

        return services
            .AddModelConfigurator<FiscalModelConfigurator>()
            .AddScoped<IRefundReceiptStatuses, RefundReceiptStatuses>()
            .AddScoped<FiscalGateway>()
            .AddScoped<ICheckboxCredentials>(sp => sp.GetRequiredService<FiscalGateway>())
            .AddScoped<IFiscalSettings, FiscalSettings>()
            .AddOutboxHandler<FiscalReceiptRequested, IssueReceiptOnRequest>();
    }

    public static IEndpointRouteBuilder MapReceiptEndpoints(this IEndpointRouteBuilder api) =>
        ReceiptEndpoints.Map(api);

    public static RouteGroupBuilder MapConsoleReceiptEndpoints(this RouteGroupBuilder console) =>
        ReceiptEndpoints.MapConsole(console);

    public static RouteGroupBuilder MapConsoleFiscalSettingsEndpoints(this RouteGroupBuilder console) =>
        FiscalSettingsEndpoints.Map(console);

    public static IEndpointRouteBuilder MapAccountReceiptEndpoints(this IEndpointRouteBuilder api) =>
        ReceiptEndpoints.MapAccount(api);
}
