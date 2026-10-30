using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity;

public sealed record CreateStaffUserRequest(string? Email, string? DisplayName, string? Role, string? Password);

public sealed record UpdateStaffUserRequest(string? DisplayName, string? Role);

public sealed record LockStaffUserRequest(bool Locked);

public sealed record ResetPasswordRequest(string? Password);

public sealed record ChangeOwnPasswordRequest(string? CurrentPassword, string? NewPassword);

/// <summary>
/// Керування доступами працівників (розділ 9 ТЗ): лише адміністратор. Кожна зміна журналюється;
/// блокування й скидання пароля завершують активні сесії працівника.
/// </summary>
public static class StaffEndpoints
{
    public static RouteGroupBuilder MapAdminStaffEndpoints(this RouteGroupBuilder admin)
    {
        var users = admin.MapGroup("/users").WithTags("Admin").RequireStaff(StaffPolicies.Admin);
        users.MapGet(string.Empty, ListAsync)
            .WithName("AdminListUsers")
            .WithSummary("Працівники та їхні ролі (лише адміністратор)");
        users.MapPost(string.Empty, CreateAsync)
            .WithName("AdminCreateUser")
            .WithSummary("Новий працівник з роллю адміністратора або менеджера");
        users.MapPut("/{id}", UpdateAsync)
            .WithName("AdminUpdateUser")
            .WithSummary("Ім'я та роль працівника")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        users.MapPost("/{id}/lock", LockAsync)
            .WithName("AdminLockUser")
            .WithSummary("Заблокувати або розблокувати доступ")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        users.MapPost("/{id}/password", ResetPasswordAsync)
            .WithName("AdminResetUserPassword")
            .WithSummary("Новий пароль працівнику; активні сесії завершуються")
            .ProducesProblem(StatusCodes.Status404NotFound);

        admin.MapGroup("/auth").WithTags("Admin").RequireStaff()
            .MapPost("/password", ChangeOwnPasswordAsync)
            .WithName("AdminChangeOwnPassword")
            .WithSummary("Зміна власного пароля");

        return admin;
    }

    private static async Task<Ok<List<StaffUserDto>>> ListAsync(UserManager<StaffUser> userManager, TimeProvider time, CancellationToken ct)
    {
        var users = await userManager.Users.OrderBy(u => u.Email).ToListAsync(ct);
        var result = new List<StaffUserDto>(users.Count);
        foreach (var user in users)
        {
            result.Add(await ToDtoAsync(userManager, user, time));
        }

        return TypedResults.Ok(result);
    }

    private static async Task<Results<Created<StaffUserDto>, ValidationProblem>> CreateAsync(
        CreateStaffUserRequest request,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time)
    {
        var errors = new Dictionary<string, string[]>();
        var email = request.Email?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > 200 || !email.Contains('@', StringComparison.Ordinal))
        {
            errors["email"] = ["Вкажіть робочий email."];
        }
        else if (await userManager.FindByEmailAsync(email) is not null)
        {
            errors["email"] = ["Працівник з таким email уже є."];
        }

        var name = ValidateName(request.DisplayName, errors);
        var role = ValidateRole(request.Role, errors);
        if (string.IsNullOrEmpty(request.Password))
        {
            errors["password"] = ["Вкажіть початковий пароль."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var user = new StaffUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = name! };
        var created = await userManager.CreateAsync(user, request.Password!);
        if (!created.Succeeded)
        {
            return TypedResults.ValidationProblem(ToErrors(created));
        }

        await userManager.AddToRoleAsync(user, role!);
        audit.Record("user.created", "StaffUser", email, new { name, role });
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/v1/admin/users/{user.Id}", await ToDtoAsync(userManager, user, time));
    }

    private static async Task<Results<Ok<StaffUserDto>, ValidationProblem, ProblemHttpResult>> UpdateAsync(
        string id,
        UpdateStaffUserRequest request,
        ClaimsPrincipal me,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return UserNotFound();
        }

        var errors = new Dictionary<string, string[]>();
        var name = ValidateName(request.DisplayName, errors);
        var role = ValidateRole(request.Role, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var roles = await userManager.GetRolesAsync(user);
        if (IsSelf(me, user) && role != StaffRoles.Admin)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "auth.self_demotion", "Не можна зняти з себе роль адміністратора", "Попросіть іншого адміністратора.");
        }

        var before = new { user.DisplayName, roles };
        user.DisplayName = name!;
        await userManager.UpdateAsync(user);
        if (!roles.Contains(role!))
        {
            await userManager.RemoveFromRolesAsync(user, roles);
            await userManager.AddToRoleAsync(user, role!);
            await userManager.UpdateSecurityStampAsync(user);
        }

        audit.Record("user.updated", "StaffUser", user.Email, new { before, after = new { name, role } });
        await db.SaveChangesAsync();
        return TypedResults.Ok(await ToDtoAsync(userManager, user, time));
    }

    private static async Task<Results<Ok<StaffUserDto>, ProblemHttpResult>> LockAsync(
        string id,
        LockStaffUserRequest request,
        ClaimsPrincipal me,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return UserNotFound();
        }

        if (request.Locked && IsSelf(me, user))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "auth.self_lock", "Не можна заблокувати власний обліковий запис");
        }

        await userManager.SetLockoutEndDateAsync(user, request.Locked ? DateTimeOffset.MaxValue : null);
        await userManager.ResetAccessFailedCountAsync(user);
        await userManager.UpdateSecurityStampAsync(user);
        audit.Record(request.Locked ? "user.locked" : "user.unlocked", "StaffUser", user.Email);
        await db.SaveChangesAsync();
        return TypedResults.Ok(await ToDtoAsync(userManager, user, time));
    }

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> ResetPasswordAsync(
        string id,
        ResetPasswordRequest request,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IAuditLog audit)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return UserNotFound();
        }

        if (await ValidatePasswordAsync(userManager, user, request.Password) is { } invalid)
        {
            return TypedResults.ValidationProblem(invalid);
        }

        await userManager.RemovePasswordAsync(user);
        await userManager.AddPasswordAsync(user, request.Password!);
        await userManager.UpdateSecurityStampAsync(user);
        audit.Record("user.password_reset", "StaffUser", user.Email);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    private static async Task<Results<NoContent, ValidationProblem>> ChangeOwnPasswordAsync(
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
                ? new Dictionary<string, string[]> { ["currentPassword"] = ["Поточний пароль невірний."] }
                : ToErrors(result, "newPassword"));
        }

        await signInManager.RefreshSignInAsync(user);
        audit.Record("user.password_changed", "StaffUser", user.Email);
        await db.SaveChangesAsync();
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
                return ToErrors(result);
            }
        }

        return null;
    }

    private static string? ValidateName(string? value, Dictionary<string, string[]> errors)
    {
        var name = value?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 100)
        {
            errors["displayName"] = ["Вкажіть ім'я до 100 символів: воно видно в історії замовлень."];
        }

        return name;
    }

    private static string? ValidateRole(string? role, Dictionary<string, string[]> errors)
    {
        if (!StaffRoles.All.Contains(role))
        {
            errors["role"] = ["Роль: Admin або Manager."];
            return null;
        }

        return role;
    }

    /// <summary>Повідомлення Identity → поле форми з українським текстом.</summary>
    private static Dictionary<string, string[]> ToErrors(IdentityResult result, string field = "password")
    {
        var messages = result.Errors.Select(e => e.Code switch
        {
            "PasswordTooShort" => "Пароль має містити щонайменше 10 символів.",
            "PasswordRequiresDigit" => "Додайте в пароль цифру.",
            "PasswordRequiresLower" => "Додайте в пароль малу літеру.",
            "PasswordRequiresUpper" => "Додайте в пароль велику літеру.",
            "PasswordRequiresNonAlphanumeric" => "Додайте в пароль символ, що не є літерою чи цифрою.",
            "PasswordMismatch" => "Поточний пароль невірний.",
            "DuplicateEmail" or "DuplicateUserName" => "Працівник з таким email уже є.",
            "InvalidEmail" or "InvalidUserName" => "Перевірте email.",
            _ => e.Description,
        }).Distinct().ToArray();
        var key = result.Errors.Any(e => e.Code.Contains("Email", StringComparison.Ordinal) || e.Code.Contains("UserName", StringComparison.Ordinal)) ? "email" : field;
        return new() { [key] = messages };
    }

    private static bool IsSelf(ClaimsPrincipal me, StaffUser user) => me.FindFirstValue(ClaimTypes.NameIdentifier) == user.Id;

    private static async Task<StaffUserDto> ToDtoAsync(UserManager<StaffUser> userManager, StaffUser user, TimeProvider time) =>
        new(user.Id, user.Email ?? string.Empty, user.DisplayName, (await userManager.GetRolesAsync(user)).ToList(), user.LockoutEnd > time.GetUtcNow());

    private static ProblemHttpResult UserNotFound() => Problems.NotFound("auth.user_not_found", "Працівника не знайдено");
}
