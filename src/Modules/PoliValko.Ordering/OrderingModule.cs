using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering;

/// <summary>Погоджений юридичний продавець першого запуску (розділи 1, 12 ТЗ). Реквізити надає замовник.</summary>
public sealed class SellerOptions
{
    public string Name { get; set; } = "реквізити продавця уточнюються";

    /// <summary>ЄДРПОУ або РНОКПП.</summary>
    public string? TaxId { get; set; }

    public string? Address { get; set; }
}

public static class OrderingModule
{
    public static IServiceCollection AddOrderingModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SellerOptions>(configuration.GetSection("Seller"));
        return services
            .AddModelConfigurator<OrderingModelConfigurator>()
            .AddScoped<CheckoutCalculator>()
            .AddOutboxHandler<OrderPlaced, NotifyManagerOnOrderPlaced>()
            .AddOutboxHandler<PaymentSucceeded, NotifyManagerOnPaymentSucceeded>();
    }
}
