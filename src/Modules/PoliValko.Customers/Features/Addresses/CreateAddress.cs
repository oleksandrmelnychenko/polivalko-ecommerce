using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Delivery.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Customers.Features.Addresses;

internal static class CreateAddress
{
    public static async Task<Results<Created<CustomerAddressDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        SaveCustomerAddressRequest request,
        HttpContext http,
        PoliValkoDbContext db,
        [FromServices] IDeliveryDirectory directory,
        TimeProvider time,
        CancellationToken ct)
    {
        var customerId = http.User.CustomerId()!.Value;
        var (errors, valid) = await AddressValidation.ValidateAsync(request, directory, ct);
        if (valid is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var existing = await db.Set<CustomerAddress>().Where(a => a.CustomerId == customerId).ToListAsync(ct);
        if (existing.Count >= CustomerAddress.MaxPerCustomer)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "account.address_limit",
                $"Можна зберегти до {CustomerAddress.MaxPerCustomer} адрес",
                "Видаліть адресу, яка вже не потрібна, щоб додати нову.");
        }

        var now = time.GetUtcNow();
        var address = new CustomerAddress
        {
            Id = Guid.CreateVersion7(now),
            CustomerId = customerId,
            DeliveryMethod = valid.Method,
            SettlementRef = valid.Settlement.Ref,
            SettlementName = valid.Settlement.Name,
            CreatedAt = now,
        };
        AddressValidation.Apply(address, valid);
        address.IsDefault = existing.Count == 0 || request.IsDefault;
        if (address.IsDefault)
        {
            foreach (var other in existing)
            {
                other.IsDefault = false;
            }
        }

        db.Add(address);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/v1/account/addresses/{address.Id}", AddressMapping.ToDto(address));
    }
}
