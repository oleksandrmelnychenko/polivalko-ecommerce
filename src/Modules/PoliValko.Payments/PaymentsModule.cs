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
using PoliValko.Payments.Integrations.LiqPay;
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

        if (PaymentProviderNames.Is(provider, PaymentProviderNames.Sandbox) && section.GetValue<bool>("AllowSandbox"))
        {
            services.AddScoped<IPaymentProvider, SandboxPaymentProvider>();
        }

        // The banks are always registered: the console turns them on and off, and payments already opened with a
        // bank that was later switched off still need webhooks, reconciliation and refunds.
        services.AddSingleton<MonoWebhookKeys>();
        services.AddHttpClient<MonoPaymentProvider>(client => client.Timeout = TimeSpan.FromSeconds(20));
        services.AddScoped<IPaymentProvider>(sp => sp.GetRequiredService<MonoPaymentProvider>());
        services.AddHttpClient<LiqPayPaymentProvider>(client => client.Timeout = TimeSpan.FromSeconds(20));
        services.AddScoped<IPaymentProvider>(sp => sp.GetRequiredService<LiqPayPaymentProvider>());
        services.AddHttpClient(PaymentGatewayEndpoints.CheckClient, client => client.Timeout = TimeSpan.FromSeconds(15));

        return services
            .AddModelConfigurator<PaymentsModelConfigurator>()
            .AddScoped<PaymentGateways>()
            .AddScoped<IPaymentCredentials>(sp => sp.GetRequiredService<PaymentGateways>())
            .AddScoped<IPaymentProviders, PaymentProviders>()
            .AddScoped<IPaymentSettings, PaymentSettings>()
            .AddScoped<ICardPayments, CardPayments>()
            .AddScoped<IPaymentActivity, PaymentActivity>()
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

    public static RouteGroupBuilder MapConsolePaymentGatewayEndpoints(this RouteGroupBuilder console) =>
        PaymentGatewayEndpoints.Map(console);

    public static IEndpointRouteBuilder MapAccountPaymentEndpoints(this IEndpointRouteBuilder api) =>
        PaymentEndpoints.MapAccount(api);
}
