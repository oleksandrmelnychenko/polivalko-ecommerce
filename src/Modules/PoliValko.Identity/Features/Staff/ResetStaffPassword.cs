using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Staff;

internal static class ResetStaffPassword
{
    public static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string id,
        ResetPasswordRequest request,
        ClaimsPrincipal me,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IStaffAccessResolver access,
        IAuditLog audit,
        CancellationToken ct)
    {
        await using var transaction = await StaffValidation.BeginChangeAsync(db, ct);
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        if (await StaffValidation.CanManageAsync(await access.GetStaffAccessAsync(me, null, ct), user, db, ct) is { } denied)
        {
            return denied;
        }

        if (await ValidatePasswordAsync(userManager, user, request.Password) is { } invalid)
        {
            return TypedResults.ValidationProblem(invalid);
        }

        if (!(await userManager.RemovePasswordAsync(user)).Succeeded
            || !(await userManager.AddPasswordAsync(user, request.Password!)).Succeeded)
        {
            return StaffValidation.UpdateConflict();
        }

        audit.Record("user.password_reset", "StaffUser", user.Email);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<Dictionary<string, string[]>?> ValidatePasswordAsync(UserManager<StaffUser> userManager, StaffUser user, string? password)
    {
        if (string.IsNullOrEmpty(password))
        {
            return new() { ["password"] = ["Вкажіть новий пароль."] };
        }

        foreach (var validator in userManager.PasswordValidators)
        {
            var result = await validator.ValidateAsync(userManager, user, password);
            if (!result.Succeeded)
            {
                return StaffValidation.ToErrors(result);
            }
        }

        return null;
    }
}
