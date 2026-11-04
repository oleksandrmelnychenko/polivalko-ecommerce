using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PoliValko.Customers.Configuration;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Auth;

internal static class CustomerSessionValidator
{
    public static async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        var services = context.HttpContext.RequestServices;
        var now = (context.Options.TimeProvider ?? TimeProvider.System).GetUtcNow();
        var interval = services.GetRequiredService<IOptions<CustomersOptions>>().Value.SessionCheckInterval;
        if (context.Properties.IssuedUtc is { } issued && now - issued < interval)
        {
            return;
        }

        var id = context.Principal.CustomerId();
        var stamp = context.Principal?.FindFirst(CustomerClaims.SecurityStamp)?.Value;
        var customer = id is null
            ? null
            : await services.GetRequiredService<PoliValkoDbContext>().Set<Customer>()
                .AsNoTracking()
                .Where(c => c.Id == id)
                .Select(c => new { c.Id, c.Email, c.Name, c.SecurityStamp })
                .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

        if (customer is null || customer.SecurityStamp != stamp)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(context.Scheme.Name);
            return;
        }

        context.ReplacePrincipal(CustomerSession.CreatePrincipal(customer.Id, customer.Email, customer.Name, customer.SecurityStamp));
        context.ShouldRenew = true;
    }
}
