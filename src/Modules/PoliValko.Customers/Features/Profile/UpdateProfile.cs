using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Profile;

internal static class UpdateProfile
{
    public static async Task<Results<Ok<CustomerMeDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        UpdateProfileRequest request,
        HttpContext http,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var customer = await CustomerLoader.LoadAsync(db, http.User, ct);
        if (customer is null)
        {
            return AccountProblems.SignedOut();
        }

        var errors = new Dictionary<string, string[]>();
        var name = CustomerValidation.Name(request.Name, errors);
        var phone = CustomerValidation.Phone(request.Phone, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        customer.Name = name!;
        customer.Phone = phone;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(CustomerMapping.ToMe(customer));
    }
}
