using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Profile;

internal static class ChangePassword
{
    public static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> HandleAsync(
        ChangeCustomerPasswordRequest request,
        HttpContext http,
        PoliValkoDbContext db,
        CustomerPasswords passwords,
        TimeProvider time,
        CancellationToken ct)
    {
        var customer = await CustomerLoader.LoadAsync(db, http.User, ct);
        if (customer is null)
        {
            return AccountProblems.SignedOut();
        }

        if (string.IsNullOrEmpty(request.CurrentPassword)
            || passwords.Verify(customer, request.CurrentPassword) == PasswordVerificationResult.Failed)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["currentPassword"] = ["Поточний пароль невірний."] });
        }

        var errors = new Dictionary<string, string[]>();
        CustomerValidation.Password(request.NewPassword, customer.Email, "newPassword", errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        customer.ChangePassword(passwords.Hash(customer, request.NewPassword!));
        await CustomerTokenQueries.RevokeOpenAsync(db, customer.Id, CustomerTokenPurpose.PasswordReset, time.GetUtcNow(), ct);
        await db.SaveChangesAsync(ct);
        await CustomerSession.SignInAsync(http, customer);
        return TypedResults.NoContent();
    }
}
