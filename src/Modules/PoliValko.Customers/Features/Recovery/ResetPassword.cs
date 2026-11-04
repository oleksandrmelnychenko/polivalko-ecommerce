using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Recovery;

internal static class ResetPassword
{
    public static async Task<Results<NoContent, ValidationProblem>> HandleAsync(
        ResetCustomerPasswordRequest request,
        PoliValkoDbContext db,
        CustomerPasswords passwords,
        TimeProvider time,
        CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var token = await CustomerTokenQueries.FindUsableAsync(db, request.Token, CustomerTokenPurpose.PasswordReset, now, ct);
        if (token is null)
        {
            return AccountProblems.InvalidToken();
        }

        var customer = await db.Set<Customer>().FirstAsync(c => c.Id == token.CustomerId, ct);
        var errors = new Dictionary<string, string[]>();
        CustomerValidation.Password(request.NewPassword, customer.Email, "newPassword", errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        customer.ChangePassword(passwords.Hash(customer, request.NewPassword!));
        customer.ClearLockout();
        await CustomerTokenQueries.RevokeOpenAsync(db, customer.Id, CustomerTokenPurpose.PasswordReset, now, ct);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }
}
