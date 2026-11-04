using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Customers.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Auth;

internal static class GetMe
{
    public static async Task<Results<Ok<CustomerMeDto>, ProblemHttpResult>> HandleAsync(
        HttpContext http,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var customer = await CustomerLoader.LoadAsync(db, http.User, ct);
        return customer is null ? AccountProblems.SignedOut() : TypedResults.Ok(CustomerMapping.ToMe(customer));
    }
}
