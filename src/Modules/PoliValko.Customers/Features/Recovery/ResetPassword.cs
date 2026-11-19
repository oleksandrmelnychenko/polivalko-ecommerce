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
        var match = await CustomerTokenQueries.FindUsableAsync(db, request.Token, CustomerTokenPurpose.PasswordReset, time.GetUtcNow(), ct, tracking: false);
        if (match is null)
        {
            return AccountProblems.InvalidToken();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var customer = await CustomerLoader.LockByIdAsync(db, match.CustomerId, ct);
        var now = time.GetUtcNow();
        if (customer is null || await CustomerTokenQueries.FindUsableAsync(db, request.Token, CustomerTokenPurpose.PasswordReset, now, ct) is null)
        {
            return AccountProblems.InvalidToken();
        }

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
        await transaction.CommitAsync(ct);
        return TypedResults.NoContent();
    }
}
