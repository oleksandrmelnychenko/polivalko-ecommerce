using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Ordering.Features.Console.Customers;

internal static class ConsoleCustomerEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        console.MapGroup("/customers").WithTags("Console").RequireStaff()
            .MapGet(string.Empty, ListCustomers.HandleAsync)
            .WithName("ConsoleListCustomers")
            .WithSummary("Покупці, зібрані із замовлень за телефоном: кількість замовлень, сума покупок, перше й останнє");
        return console;
    }
}
