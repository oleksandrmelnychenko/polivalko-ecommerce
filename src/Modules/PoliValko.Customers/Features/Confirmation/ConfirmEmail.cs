using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Confirmation;

internal static class ConfirmEmail
{
    public static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> HandleAsync(
        ConfirmEmailRequest request,
        HttpContext http,
        PoliValkoDbContext db,
        [FromServices] IEnumerable<ICustomerEmailConfirmedHandler> handlers,
        TimeProvider time,
        CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var token = await CustomerTokenQueries.FindUsableAsync(db, request.Token, CustomerTokenPurpose.EmailConfirmation, now, ct);
        if (token is null)
        {
            return AccountProblems.InvalidToken();
        }

        var customer = await CustomerLoader.LoadAsync(db, http.User, ct);
        if (customer is null) return AccountProblems.SignedOut();
        if (customer.Id != token.CustomerId) return AccountProblems.InvalidToken();
        token.UsedAt = now;
        if (customer.ConfirmEmail(now))
        {
            foreach (var handler in handlers)
            {
                await handler.OnEmailConfirmedAsync(customer.Id, customer.Email, ct);
            }
        }

        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }
}
