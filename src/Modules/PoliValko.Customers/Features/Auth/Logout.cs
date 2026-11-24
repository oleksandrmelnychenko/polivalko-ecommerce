using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Auth;

internal static class Logout
{
    public static async Task<NoContent> HandleAsync(HttpContext http, PoliValkoDbContext db, CancellationToken ct)
    {
        // Deleting the cookie in this browser is not enough: a copy of it would stay valid for weeks.
        // A new stamp ends every session of the account, as a password change does.
        var id = http.User.CustomerId();
        if (id is not null && await db.Set<Customer>().SingleOrDefaultAsync(c => c.Id == id, ct) is { } customer)
        {
            customer.EndSessions();
            await db.SaveChangesAsync(ct);
        }
        await CustomerSession.SignOutAsync(http);
        return TypedResults.NoContent();
    }
}
