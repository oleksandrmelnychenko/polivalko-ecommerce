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
    public static async Task<Results<NoContent, ValidationProblem>> HandleAsync(
        ConfirmEmailRequest request,
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

        var customer = await db.Set<Customer>().FirstAsync(c => c.Id == token.CustomerId, ct);
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
