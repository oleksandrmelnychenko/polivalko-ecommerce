using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Identity.Features.Staff;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.TwoFactor;

internal static class OwnTwoFactor
{
    public static async Task<Results<Ok<TwoFactorStatusDto>, ProblemHttpResult>> StatusAsync(ClaimsPrincipal me, UserManager<StaffUser> users)
    {
        var user = await users.GetUserAsync(me);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        var enabled = await users.GetTwoFactorEnabledAsync(user);
        return TypedResults.Ok(new TwoFactorStatusDto(enabled, enabled ? await users.CountRecoveryCodesAsync(user) : 0));
    }

    public static async Task<Results<Ok<TwoFactorSetupDto>, ProblemHttpResult>> SetupAsync(
        ClaimsPrincipal me,
        UserManager<StaffUser> users,
        SignInManager<StaffUser> signIn)
    {
        var user = await users.GetUserAsync(me);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        if (await users.GetTwoFactorEnabledAsync(user))
        {
            return AlreadyEnabled();
        }

        await users.ResetAuthenticatorKeyAsync(user);
        await signIn.RefreshSignInAsync(user);
        var key = await users.GetAuthenticatorKeyAsync(user) ?? string.Empty;
        return TypedResults.Ok(new TwoFactorSetupDto(TwoFactorCodes.FormatKey(key), TwoFactorCodes.AuthenticatorUri(user.Email ?? string.Empty, key)));
    }

    public static async Task<Results<Ok<TwoFactorRecoveryCodesDto>, ValidationProblem, ProblemHttpResult>> EnableAsync(
        TwoFactorCodeRequest request,
        ClaimsPrincipal me,
        UserManager<StaffUser> users,
        SignInManager<StaffUser> signIn,
        PoliValkoDbContext db,
        IAuditLog audit)
    {
        var user = await users.GetUserAsync(me);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        if (await users.GetTwoFactorEnabledAsync(user))
        {
            return AlreadyEnabled();
        }

        if (string.IsNullOrEmpty(await users.GetAuthenticatorKeyAsync(user)))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "two_factor.setup_missing", "Спершу додайте ключ у застосунок", "Почніть налаштування заново.");
        }

        if (!await TwoFactorCodes.VerifyAuthenticatorAsync(users, user, request.Code))
        {
            return InvalidCode();
        }

        await users.SetTwoFactorEnabledAsync(user, true);
        var codes = await users.GenerateNewTwoFactorRecoveryCodesAsync(user, TwoFactorCodes.RecoveryCodeCount) ?? [];
        await signIn.RefreshSignInAsync(user);
        audit.Record("user.two_factor_enabled", "StaffUser", user.Email);
        await db.SaveChangesAsync();
        return TypedResults.Ok(new TwoFactorRecoveryCodesDto(codes.ToList()));
    }

    public static async Task<Results<Ok<TwoFactorRecoveryCodesDto>, ValidationProblem, ProblemHttpResult>> RegenerateRecoveryCodesAsync(
        TwoFactorCodeRequest request,
        ClaimsPrincipal me,
        UserManager<StaffUser> users,
        PoliValkoDbContext db,
        IAuditLog audit)
    {
        var user = await users.GetUserAsync(me);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        if (await GuardAsync(users, user) is { } problem)
        {
            return problem;
        }

        if (!await CheckCodeAsync(users, user, request.Code))
        {
            if (await users.IsLockedOutAsync(user))
            {
                return TwoFactorCodes.LockedOut();
            }

            return InvalidCode();
        }

        var codes = await users.GenerateNewTwoFactorRecoveryCodesAsync(user, TwoFactorCodes.RecoveryCodeCount) ?? [];
        audit.Record("user.recovery_codes_generated", "StaffUser", user.Email);
        await db.SaveChangesAsync();
        return TypedResults.Ok(new TwoFactorRecoveryCodesDto(codes.ToList()));
    }

    public static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> DisableAsync(
        TwoFactorCodeRequest request,
        ClaimsPrincipal me,
        UserManager<StaffUser> users,
        SignInManager<StaffUser> signIn,
        PoliValkoDbContext db,
        IAuditLog audit)
    {
        var user = await users.GetUserAsync(me);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        if (await GuardAsync(users, user) is { } problem)
        {
            return problem;
        }

        if (!await CheckCodeAsync(users, user, request.Code))
        {
            if (await users.IsLockedOutAsync(user))
            {
                return TwoFactorCodes.LockedOut();
            }

            return InvalidCode();
        }

        await TurnOffAsync(users, user);
        await signIn.RefreshSignInAsync(user);
        audit.Record("user.two_factor_disabled", "StaffUser", user.Email);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    public static async Task TurnOffAsync(UserManager<StaffUser> users, StaffUser user)
    {
        await users.SetTwoFactorEnabledAsync(user, false);
        await users.GenerateNewTwoFactorRecoveryCodesAsync(user, 0);
        await users.ResetAuthenticatorKeyAsync(user);
    }

    private static async Task<ProblemHttpResult?> GuardAsync(UserManager<StaffUser> users, StaffUser user)
    {
        if (!await users.GetTwoFactorEnabledAsync(user))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "two_factor.not_enabled", "Двофакторну перевірку не ввімкнено");
        }

        return await users.IsLockedOutAsync(user) ? TwoFactorCodes.LockedOut() : null;
    }

    private static async Task<bool> CheckCodeAsync(UserManager<StaffUser> users, StaffUser user, string? code)
    {
        if (await TwoFactorCodes.VerifyAuthenticatorAsync(users, user, code))
        {
            await users.ResetAccessFailedCountAsync(user);
            return true;
        }

        await users.AccessFailedAsync(user);
        return false;
    }

    private static ProblemHttpResult AlreadyEnabled() =>
        Problems.Create(StatusCodes.Status409Conflict, "two_factor.already_enabled", "Двофакторну перевірку вже ввімкнено");

    private static ValidationProblem InvalidCode() =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["code"] = ["Код не підходить. Перевірте, що час на телефоні виставлено автоматично, і введіть новий код."],
        });
}
