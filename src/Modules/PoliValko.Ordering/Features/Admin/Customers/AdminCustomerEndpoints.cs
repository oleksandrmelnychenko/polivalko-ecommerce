using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Ordering.Features.Admin.Customers;

internal static class AdminCustomerEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        admin.MapGroup("/customers").WithTags("Admin").RequireStaff()
            .MapGet(string.Empty, ListCustomers.HandleAsync)
            .WithName("AdminListCustomers")
            .WithSummary("Покупці, зібрані із замовлень за телефоном: кількість замовлень, сума покупок, перше й останнє");
        return admin;
    }
}
