using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Delivery.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Addresses;

internal static class UpdateAddress
{
    public static async Task<Results<Ok<CustomerAddressDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        SaveCustomerAddressRequest request,
        HttpContext http,
        PoliValkoDbContext db,
        [FromServices] IDeliveryDirectory directory,
        CancellationToken ct)
    {
        var customerId = http.User.CustomerId();
        var addresses = await db.Set<CustomerAddress>().Where(a => a.CustomerId == customerId).ToListAsync(ct);
        var address = addresses.FirstOrDefault(a => a.Id == id);
        if (address is null)
        {
            return AddressMapping.NotFound();
        }

        var (errors, valid) = await AddressValidation.ValidateAsync(request, directory, ct);
        if (valid is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        AddressValidation.Apply(address, valid);
        if (request.IsDefault && !address.IsDefault)
        {
            foreach (var other in addresses)
            {
                other.IsDefault = other.Id == address.Id;
            }
        }

        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(AddressMapping.ToDto(address));
    }
}
