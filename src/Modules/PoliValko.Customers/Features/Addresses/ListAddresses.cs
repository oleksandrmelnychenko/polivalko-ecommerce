using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Addresses;

internal static class ListAddresses
{
    public static async Task<Ok<List<CustomerAddressDto>>> HandleAsync(HttpContext http, PoliValkoDbContext db, CancellationToken ct)
    {
        var customerId = http.User.CustomerId();
        var addresses = await db.Set<CustomerAddress>()
            .AsNoTracking()
            .Where(a => a.CustomerId == customerId)
            .OrderByDescending(a => a.IsDefault)
            .ThenBy(a => a.CreatedAt)
            .ToListAsync(ct);
        return TypedResults.Ok(addresses.Select(AddressMapping.ToDto).ToList());
    }
}
