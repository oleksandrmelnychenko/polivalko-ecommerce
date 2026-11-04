using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Addresses;

internal static class DeleteAddress
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
        HttpContext http,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var customerId = http.User.CustomerId();
        var addresses = await db.Set<CustomerAddress>().Where(a => a.CustomerId == customerId).ToListAsync(ct);
        var address = addresses.FirstOrDefault(a => a.Id == id);
        if (address is null)
        {
            return AddressMapping.NotFound();
        }

        db.Remove(address);
        if (address.IsDefault
            && addresses.Where(a => a.Id != id).OrderBy(a => a.CreatedAt).FirstOrDefault() is { } next)
        {
            next.IsDefault = true;
        }

        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }
}
