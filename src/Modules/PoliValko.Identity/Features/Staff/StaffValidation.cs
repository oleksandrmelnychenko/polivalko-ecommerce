using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Staff;

internal static class StaffValidation
{
    public static string? ValidateName(string? value, Dictionary<string, string[]> errors)
    {
        var name = value?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 100)
        {
            errors["displayName"] = ["Вкажіть ім'я до 100 символів: воно видно в історії замовлень."];
        }

        return name;
    }

    public static async Task<StaffRole?> ValidateRoleAsync(string? roleId, PoliValkoDbContext db, Dictionary<string, string[]> errors, CancellationToken ct)
    {
        var role = string.IsNullOrWhiteSpace(roleId) ? null : await db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == roleId, ct);
        if (role is null)
        {
            errors["roleId"] = ["Оберіть роль працівника."];
        }

        return role;
    }

    public static async Task<ProblemHttpResult?> CanGrantAsync(StaffAccess? me, StaffRole role, PoliValkoDbContext db, CancellationToken ct)
    {
        if (me is null)
        {
            return Forbidden("Немає доступу до керування працівниками.");
        }

        if (me.IsSuperuser)
        {
            return null;
        }

        if (role.IsSuperuser)
        {
            return Forbidden("Роль адміністратора призначає лише адміністратор.");
        }

        var keys = await db.RolePermissions.AsNoTracking().Where(p => p.RoleId == role.Id).Select(p => p.Key).ToListAsync(ct);
        return keys.All(me.Has) ? null : Forbidden("Ця роль має права, яких немає у вас.");
    }

    public static async Task<ProblemHttpResult?> CanManageAsync(StaffAccess? me, StaffUser user, PoliValkoDbContext db, CancellationToken ct)
    {
        if (me is null)
        {
            return Forbidden("Немає доступу до керування працівниками.");
        }

        if (me.IsSuperuser)
        {
            return null;
        }

        var current = await StaffMapping.StaffRolesOf(db, user.Id).AsNoTracking().FirstOrDefaultAsync(ct);
        return current is null ? null : await CanGrantAsync(me, current, db, ct);
    }

    public static async Task<bool> IsLastActiveSuperuserAsync(PoliValkoDbContext db, StaffUser user, TimeProvider time, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var superusers = await (
                from link in db.UserRoles
                join role in db.Roles on link.RoleId equals role.Id
                where role.IsSuperuser
                join u in db.Users on link.UserId equals u.Id
                where u.LockoutEnd == null || u.LockoutEnd <= now
                select u.Id)
            .Distinct()
            .ToListAsync(ct);
        return superusers.Count == 1 && superusers[0] == user.Id;
    }

    public static ProblemHttpResult LastSuperuser() =>
        Problems.Create(StatusCodes.Status409Conflict, "staff.last_superuser", "Це останній активний адміністратор", "Спершу призначте роль адміністратора іншому працівнику.");

    public static Dictionary<string, string[]> ToErrors(IdentityResult result, string field = "password")
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

    public static bool IsSelf(ClaimsPrincipal me, StaffUser user) => me.FindFirstValue(ClaimTypes.NameIdentifier) == user.Id;

    private static ProblemHttpResult Forbidden(string detail) =>
        Problems.Create(StatusCodes.Status403Forbidden, "staff.escalation", "Недостатньо прав", detail);
}
