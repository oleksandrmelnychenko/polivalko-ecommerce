using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Customers.Contracts;

public static class CustomerEndpointExtensions
{
    public static RouteGroupBuilder RequireCustomer(this RouteGroupBuilder group)
    {
        group.RequireAuthorization(CustomerPolicies.Customer);
        group.RequireCsrf();
        group.ProducesProblem(StatusCodes.Status401Unauthorized);
        return group;
    }
}
