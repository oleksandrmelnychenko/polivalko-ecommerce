using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Features.Console;
using PoliValko.Customers.Features.Directory;
using PoliValko.Customers.Features.Mail;
using PoliValko.Customers.Persistence;
using PoliValko.Infrastructure;

namespace PoliValko.Customers;

public static class CustomersModule
{
    public static IServiceCollection AddCustomersModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddCustomerAuthentication();
        return services
            .AddModelConfigurator<CustomersModelConfigurator>()
            .AddSingleton<IPasswordHasher<Customer>, PasswordHasher<Customer>>()
            .AddSingleton<CustomerPasswords>()
            .AddScoped<AccountMail>()
            .AddScoped<ICustomerDirectory, CustomerDirectory>();
    }

    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder api) =>
        AccountEndpoints.Map(api);

    public static RouteGroupBuilder MapConsoleAccountEndpoints(this RouteGroupBuilder console) =>
        ConsoleAccountEndpoints.Map(console);
}
