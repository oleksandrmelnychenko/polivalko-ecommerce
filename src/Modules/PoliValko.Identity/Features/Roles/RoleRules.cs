using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Roles;

internal static class RoleRules
{
    public const int NameMaxLength = 60;

    public const int DescriptionMaxLength = 300;

    public static async Task<(string? Name, string? Description)> ValidateAsync(
        SaveStaffRoleRequest request,
        string? exceptRoleId,
        PoliValkoDbContext db,
        Dictionary<string, string[]> errors,
        CancellationToken ct)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length < 2 || name.Length > NameMaxLength)
        {
            errors["name"] = [$"Назва ролі має містити від 2 до {NameMaxLength} символів."];
        }
        else
        {
            var lowered = name.ToLowerInvariant();
            if (await db.Roles.AnyAsync(r => r.Id != exceptRoleId && r.DisplayName.ToLower() == lowered, ct))
            {
                errors["name"] = ["Роль з такою назвою вже є."];
            }
        }

        var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        if (description is { Length: > DescriptionMaxLength })
        {
            errors["description"] = [$"Опис має бути не довшим за {DescriptionMaxLength} символів."];
        }

        return (name, description);
    }

    public static async Task<StaffRoleDto> ToDtoAsync(PoliValkoDbContext db, StaffRole role, CancellationToken ct)
    {
        var users = await db.UserRoles.CountAsync(link => link.RoleId == role.Id, ct);
        var permissions = role.IsSuperuser
            ? PermissionCatalog.Permissions.Count
            : await db.RolePermissions.CountAsync(p => p.RoleId == role.Id, ct);
        return new StaffRoleDto(role.Id, role.DisplayName, role.Description, role.IsSystem, role.IsSuperuser, users, permissions, role.PermissionsVersion, role.UpdatedAt, role.UpdatedBy);
    }

    public static async Task<RolePermissionsDto> ToPermissionsDtoAsync(PoliValkoDbContext db, StaffRole role, CancellationToken ct)
    {
        IEnumerable<string> keys = role.IsSuperuser
            ? PermissionCatalog.AllKeys
            : await db.RolePermissions.AsNoTracking().Where(p => p.RoleId == role.Id).Select(p => p.Key).ToListAsync(ct);
        return new RolePermissionsDto(role.Id, role.PermissionsVersion, PermissionCatalog.Order(keys), role.IsSuperuser, role.UpdatedAt, role.UpdatedBy, PermissionCatalog.Version);
    }

    public static ProblemHttpResult? Escalation(StaffAccess? me, IEnumerable<string> granted)
    {
        if (me?.IsSuperuser == true)
        {
            return null;
        }

        var missing = granted.Where(key => me is null || !me.Has(key)).ToList();
        return missing.Count == 0
            ? null
            : Problems.Create(
                StatusCodes.Status403Forbidden,
                "roles.escalation",
                "Не можна надати права, яких немає у вас",
                string.Join(", ", missing),
                [new("missingKeys", missing)]);
    }

    public static ProblemHttpResult NotFound() => Problems.NotFound("roles.not_found", "Роль не знайдено");

    public static ProblemHttpResult Superuser() =>
        Problems.Create(StatusCodes.Status409Conflict, "roles.superuser", "Роль адміністратора змінити не можна", "Адміністратор завжди має всі права.");
}
