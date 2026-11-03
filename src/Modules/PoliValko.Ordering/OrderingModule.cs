using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure;
using PoliValko.Ordering.Configuration;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Admin.Customers;
using PoliValko.Ordering.Features.Admin.Orders;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Features.Export;
using PoliValko.Ordering.Features.Notifications;
using PoliValko.Ordering.Features.PaymentState;
using PoliValko.Ordering.Features.Receipts;
using PoliValko.Ordering.Features.Reporting;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering;

public static class OrderingModule
{
    public static IServiceCollection AddOrderingModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SellerOptions>(configuration.GetSection("Seller"));
        return services
            .AddModelConfigurator<OrderingModelConfigurator>()
            .AddScoped<CheckoutCalculator>()
            .AddScoped<IOrderPayments, OrderPayments>()
            .AddScoped<IOrderReceiptSource, OrderReceiptSource>()
            .AddScoped<IOrderExportSource, OrderExportSource>()
            .AddScoped<IOrderReporting, OrderReporting>()
            .AddOutboxHandler<OrderPlaced, NotifyManagerOnOrderPlaced>()
            .AddOutboxHandler<PaymentSucceeded, NotifyManagerOnPaymentSucceeded>();
    }

    public static IEndpointRouteBuilder MapCheckoutEndpoints(this IEndpointRouteBuilder api) =>
        CheckoutEndpoints.Map(api);

    public static RouteGroupBuilder MapAdminOrderEndpoints(this RouteGroupBuilder admin) =>
        AdminOrderEndpoints.Map(admin);

    public static RouteGroupBuilder MapAdminCustomerEndpoints(this RouteGroupBuilder admin) =>
        AdminCustomerEndpoints.Map(admin);
}
