using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Features.Admin;
using PoliValko.Payments.Features.Checkout;
using PoliValko.Payments.Features.Processing;
using PoliValko.Payments.Features.Refunds;
using PoliValko.Payments.Integrations.Mono;
using PoliValko.Payments.Integrations.Providers;
using PoliValko.Payments.Integrations.Sandbox;
using PoliValko.Payments.Jobs;
using PoliValko.Payments.Persistence;

namespace PoliValko.Payments;

public static class PaymentsModule
{
    public static IServiceCollection AddPaymentsModule(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Payments");
        services.Configure<PaymentsOptions>(section);
        var provider = section.GetValue<string>("Provider");

        if (string.Equals(provider, PaymentProviderNames.Sandbox, StringComparison.OrdinalIgnoreCase))
        {
            services.AddScoped<IPaymentProvider, SandboxPaymentProvider>();
        }
        else if (string.Equals(provider, PaymentProviderNames.Mono, StringComparison.OrdinalIgnoreCase))
        {
            services.AddHttpClient<MonoPaymentProvider>(client => client.Timeout = TimeSpan.FromSeconds(20));
            services.AddScoped<IPaymentProvider>(sp => sp.GetRequiredService<MonoPaymentProvider>());
        }

        return services
            .AddModelConfigurator<PaymentsModelConfigurator>()
            .AddScoped<IPaymentProviders, PaymentProviders>()
            .AddScoped<PaymentProcessor>()
            .AddOutboxHandler<RefundRequested, ProcessRefundRequested>();
    }

    public static IServiceCollection AddPaymentsJobs(this IServiceCollection services) =>
        services.AddHostedService<PaymentReconciliationJob>();

    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder api) =>
        PaymentEndpoints.Map(api);

    public static RouteGroupBuilder MapAdminPaymentEndpoints(this RouteGroupBuilder admin) =>
        AdminPaymentEndpoints.Map(admin);
}
