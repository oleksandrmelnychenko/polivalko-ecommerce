using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Auth;

internal static class Login
{
    public static async Task<Results<Ok<StaffMeDto>, ProblemHttpResult>> HandleAsync(
        LoginRequest request,
        UserManager<StaffUser> userManager,
        SignInManager<StaffUser> signInManager)
    {
        var user = string.IsNullOrWhiteSpace(request.Email) ? null : await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || string.IsNullOrEmpty(request.Password))
        {
            return InvalidCredentials();
        }

        var result = await signInManager.PasswordSignInAsync(user, request.Password, isPersistent: false, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return Problems.Create(
                StatusCodes.Status403Forbidden,
                "auth.locked_out",
                "Обліковий запис тимчасово заблоковано",
                "Забагато невдалих спроб. Спробуйте через 15 хвилин або зверніться до адміністратора.");
        }

        if (!result.Succeeded)
        {
            return InvalidCredentials();
        }

        return TypedResults.Ok(new StaffMeDto(user.Email!, user.DisplayName, (await userManager.GetRolesAsync(user)).ToList()));
    }

    private static ProblemHttpResult InvalidCredentials() =>
        Problems.Create(StatusCodes.Status401Unauthorized, "auth.invalid_credentials", "Невірний email або пароль");
}
