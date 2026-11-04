using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure;
using PoliValko.Ordering.Configuration;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Account;
using PoliValko.Ordering.Features.Console.Customers;
using PoliValko.Ordering.Features.Console.Orders;
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
            .AddScoped<ICustomerEmailConfirmedHandler, LinkGuestOrders>()
            .AddOutboxHandler<OrderPlaced, NotifyManagerOnOrderPlaced>()
            .AddOutboxHandler<PaymentSucceeded, NotifyManagerOnPaymentSucceeded>();
    }

    public static IEndpointRouteBuilder MapCheckoutEndpoints(this IEndpointRouteBuilder api) =>
        CheckoutEndpoints.Map(api);

    public static RouteGroupBuilder MapConsoleOrderEndpoints(this RouteGroupBuilder console) =>
        ConsoleOrderEndpoints.Map(console);

    public static RouteGroupBuilder MapConsoleCustomerEndpoints(this RouteGroupBuilder console) =>
        ConsoleCustomerEndpoints.Map(console);

    public static IEndpointRouteBuilder MapAccountOrderEndpoints(this IEndpointRouteBuilder api) =>
        AccountOrderEndpoints.Map(api);
}
