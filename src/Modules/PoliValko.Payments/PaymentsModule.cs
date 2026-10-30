using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure;
using PoliValko.Ordering;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Providers;

namespace PoliValko.Payments;

public static class PaymentsModule
{
    /// <summary>
    /// Платежі: спроби оплати, вебхуки, повернення. Провайдер обирається <c>Payments:Provider</c>;
    /// тестовий провайдер реєструється лише тоді, коли його обрано, тож на production його маршрути недоступні.
    /// </summary>
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

    /// <summary>Фонова звірка оплат. Лише в хості Worker.</summary>
    public static IServiceCollection AddPaymentsJobs(this IServiceCollection services) =>
        services.AddHostedService<PaymentReconciliationJob>();
}
