using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Identity.Features.TwoFactor;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Auth;

internal static class Login
{
    public static async Task<Results<Ok<StaffMeDto>, ProblemHttpResult>> HandleAsync(
        LoginRequest request,
        UserManager<StaffUser> userManager,
        SignInManager<StaffUser> signInManager,
        IStaffAccessResolver access,
        CancellationToken ct)
    {
        var user = string.IsNullOrWhiteSpace(request.Email) ? null : await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || string.IsNullOrEmpty(request.Password))
        {
            return InvalidCredentials();
        }

        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return TwoFactorCodes.LockedOut();
        }

        if (!result.Succeeded)
        {
            return InvalidCredentials();
        }

        var twoFactor = await userManager.GetTwoFactorEnabledAsync(user);
        if (twoFactor && await VerifySecondFactorAsync(userManager, user, request.TwoFactorCode) is { } failure)
        {
            return failure;
        }

        await signInManager.SignInAsync(user, isPersistent: false, authenticationMethod: twoFactor ? "mfa" : "pwd");
        var mine = await access.GetAsync(user.Id, ct);
        return TypedResults.Ok(new StaffMeDto(user.Email!, user.DisplayName, mine?.RoleId ?? string.Empty, mine?.RoleName ?? string.Empty));
    }

    private static async Task<ProblemHttpResult?> VerifySecondFactorAsync(UserManager<StaffUser> userManager, StaffUser user, string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Problems.Create(
                StatusCodes.Status401Unauthorized,
                "auth.two_factor_required",
                "Потрібен код підтвердження",
                "Введіть код із застосунку-автентифікатора або резервний код.");
        }

        var valid = TwoFactorCodes.LooksLikeAuthenticatorCode(code)
            ? await TwoFactorCodes.VerifyAuthenticatorAsync(userManager, user, code)
            : await TwoFactorCodes.RedeemRecoveryCodeAsync(userManager, user, code);
        if (valid)
        {
            await userManager.ResetAccessFailedCountAsync(user);
            return null;
        }

        await userManager.AccessFailedAsync(user);
        if (await userManager.IsLockedOutAsync(user))
        {
            return TwoFactorCodes.LockedOut();
        }

        return Problems.Create(StatusCodes.Status401Unauthorized, "auth.invalid_two_factor_code", "Код не підходить", "Введіть новий код із застосунку або невикористаний резервний код.");
    }

    private static ProblemHttpResult InvalidCredentials() =>
        Problems.Create(StatusCodes.Status401Unauthorized, "auth.invalid_credentials", "Неправильний email або пароль");
}
