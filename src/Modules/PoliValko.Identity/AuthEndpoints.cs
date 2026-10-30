using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity;

public sealed record LoginRequest(string? Email, string? Password);

public sealed record StaffMeDto(string Email, string DisplayName, IReadOnlyList<string> Roles);

public sealed record CsrfTokenDto(string Token);

public sealed record StaffUserDto(string Id, string Email, string DisplayName, IReadOnlyList<string> Roles, bool LockedOut);

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAdminAuthEndpoints(this RouteGroupBuilder admin)
    {
        var auth = admin.MapGroup("/auth").WithTags("Admin");

        // Вхід без CSRF-токена: токен прив'язаний до користувача й до входу ще недійсний.
        // Від підробки запиту захищають SameSite=Strict cookie та JSON-тіло.
        auth.MapPost("/login", LoginAsync)
            .RequireRateLimiting(IdentityModule.LoginRateLimitPolicy)
            .WithName("AdminLogin")
            .WithSummary("Вхід працівника; встановлює cookie pv_admin")
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        auth.MapPost("/logout", LogoutAsync)
            .RequireAuthorization(StaffPolicies.Staff)
            .RequireCsrf()
            .WithName("AdminLogout")
            .WithSummary("Вихід");

        auth.MapGet("/me", MeAsync)
            .RequireAuthorization(StaffPolicies.Staff)
            .WithName("AdminMe")
            .WithSummary("Поточний працівник і його ролі")
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        auth.MapGet("/csrf", (HttpContext http, IAntiforgery antiforgery) =>
                TypedResults.Ok(new CsrfTokenDto(antiforgery.GetAndStoreTokens(http).RequestToken!)))
            .WithName("AdminCsrf")
            .WithSummary("Токен для заголовка X-CSRF-TOKEN; отримуйте після входу");

        return admin;
    }

    private static async Task<Results<Ok<StaffMeDto>, ProblemHttpResult>> LoginAsync(
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

    private static async Task<NoContent> LogoutAsync(SignInManager<StaffUser> signInManager)
    {
        await signInManager.SignOutAsync();
        return TypedResults.NoContent();
    }

    private static Ok<StaffMeDto> MeAsync(ClaimsPrincipal user) =>
        TypedResults.Ok(new StaffMeDto(
            user.FindFirstValue(ClaimTypes.Email) ?? user.Identity?.Name ?? string.Empty,
            user.StaffName(),
            user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList()));

    private static ProblemHttpResult InvalidCredentials() =>
        Problems.Create(StatusCodes.Status401Unauthorized, "auth.invalid_credentials", "Невірний email або пароль");
}
