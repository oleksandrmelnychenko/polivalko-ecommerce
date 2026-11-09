using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Staff;

internal static class ChangeOwnPassword
{
    public static async Task<Results<NoContent, ValidationProblem>> HandleAsync(
        ChangeOwnPasswordRequest request,
        ClaimsPrincipal me,
        UserManager<StaffUser> userManager,
        SignInManager<StaffUser> signInManager,
        PoliValkoDbContext db,
        IAuditLog audit)
    {
        var user = await userManager.GetUserAsync(me);
        if (user is null || string.IsNullOrEmpty(request.CurrentPassword) || string.IsNullOrEmpty(request.NewPassword))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["newPassword"] = ["Вкажіть поточний і новий пароль."] });
        }

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            return TypedResults.ValidationProblem(result.Errors.Any(e => e.Code == "PasswordMismatch")
                ? new Dictionary<string, string[]> { ["currentPassword"] = ["Поточний пароль неправильний."] }
                : StaffValidation.ToErrors(result, "newPassword"));
        }

        await signInManager.RefreshSignInAsync(user);
        audit.Record("user.password_changed", "StaffUser", user.Email);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }
}
