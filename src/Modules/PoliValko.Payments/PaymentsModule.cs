using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Contracts;
using PoliValko.Payments.Features.Cancellation;
using PoliValko.Payments.Features.Console;
using PoliValko.Payments.Features.Checkout;
using PoliValko.Payments.Features.Processing;
using PoliValko.Payments.Features.Refunds;
using PoliValko.Payments.Features.Settings;
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
        services.AddOptions<PaymentsOptions>().Bind(section)
            .Validate(o => PaymentProviderNames.IsKnown(o.Provider), "Payments:Provider: допустимі значення — порожньо або Disabled, Sandbox, Mono.")
            .Validate(
                o => !PaymentProviderNames.Is(o.Provider, PaymentProviderNames.Sandbox) || o.AllowSandbox,
                "Payments:Provider=Sandbox заборонено на цьому сервері (Payments:AllowSandbox=false): тестова оплата дає змогу будь-кому позначити замовлення оплаченим.")
            .Validate(
                o => !PaymentProviderNames.Is(o.Provider, PaymentProviderNames.Mono) || !string.IsNullOrWhiteSpace(o.Mono.Token),
                "Payments:Mono:Token обов'язковий для Payments:Provider=Mono.")
            .ValidateOnStart();
        var provider = section.GetValue<string>("Provider");

        if (PaymentProviderNames.Is(provider, PaymentProviderNames.Sandbox))
        {
            services.AddScoped<IPaymentProvider, SandboxPaymentProvider>();
        }
        else if (PaymentProviderNames.Is(provider, PaymentProviderNames.Mono))
        {
            services.AddHttpClient<MonoPaymentProvider>(client => client.Timeout = TimeSpan.FromSeconds(20));
            services.AddScoped<IPaymentProvider>(sp => sp.GetRequiredService<MonoPaymentProvider>());
        }

        return services
            .AddModelConfigurator<PaymentsModelConfigurator>()
            .AddScoped<IPaymentProviders, PaymentProviders>()
            .AddSingleton<IPaymentSettings, PaymentSettings>()
            .AddScoped<PaymentProcessor>()
            .AddScoped<RefundSettlement>()
            .AddOutboxHandler<RefundRequested, ProcessRefundRequested>()
            .AddOutboxHandler<PaymentCancellationRequested, CancelOpenPayments>();
    }

    public static IServiceCollection AddPaymentsJobs(this IServiceCollection services) =>
        services.AddHostedService<PaymentReconciliationJob>();

    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder api) =>
        PaymentEndpoints.Map(api);

    public static RouteGroupBuilder MapConsolePaymentEndpoints(this RouteGroupBuilder console) =>
        ConsolePaymentEndpoints.Map(console);

    public static IEndpointRouteBuilder MapAccountPaymentEndpoints(this IEndpointRouteBuilder api) =>
        PaymentEndpoints.MapAccount(api);
}
