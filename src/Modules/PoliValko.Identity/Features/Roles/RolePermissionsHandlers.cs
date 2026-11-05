using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Roles;

internal static class GetRolePermissions
{
    public static async Task<Results<Ok<RolePermissionsDto>, ProblemHttpResult>> HandleAsync(string id, PoliValkoDbContext db, CancellationToken ct)
    {
        var role = await db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        return role is null ? RoleRules.NotFound() : TypedResults.Ok(await RoleRules.ToPermissionsDtoAsync(db, role, ct));
    }
}

internal static class UpdateRolePermissions
{
    public static async Task<Results<Ok<RolePermissionsDto>, ProblemHttpResult>> HandleAsync(
        string id,
        UpdateRolePermissionsRequest request,
        ClaimsPrincipal me,
        HttpContext http,
        PoliValkoDbContext db,
        IStaffAccessResolver access,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var role = await db.Roles.Include(r => r.Permissions).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null)
        {
            return RoleRules.NotFound();
        }

        if (role.IsSuperuser)
        {
            return RoleRules.Superuser();
        }

        var requested = (request.PermissionKeys ?? [])
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Select(key => key.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var unknown = requested.Where(key => !PermissionCatalog.Contains(key)).OrderBy(key => key, StringComparer.Ordinal).ToList();
        if (unknown.Count > 0)
        {
            return Problems.Create(
                StatusCodes.Status400BadRequest,
                "roles.unknown_permissions",
                "Невідомі права",
                string.Join(", ", unknown),
                [new("unknownKeys", unknown)]);
        }

        if (request.ExpectedVersion != role.PermissionsVersion)
        {
            return VersionConflict(role.PermissionsVersion);
        }

        var current = role.Permissions.Select(p => p.Key).ToHashSet(StringComparer.Ordinal);
        var desired = requested.ToHashSet(StringComparer.Ordinal);
        var removed = role.Permissions.Where(p => !desired.Contains(p.Key)).ToList();
        foreach (var permission in removed)
        {
            role.Permissions.Remove(permission);
        }

        var added = PermissionCatalog.Order(desired.Where(key => !current.Contains(key)));
        if (RoleRules.Escalation(await access.GetStaffAccessAsync(me, http.Items, ct), added) is { } denied)
        {
            return denied;
        }

        foreach (var key in added)
        {
            role.Permissions.Add(new StaffRolePermission { RoleId = role.Id, Key = key });
        }

        role.PermissionsVersion++;
        role.UpdatedAt = time.GetUtcNow();
        role.UpdatedBy = me.StaffName();
        audit.Record("role.permissions_updated", "StaffRole", role.Id, new
        {
            name = role.DisplayName,
            added,
            removed = PermissionCatalog.Order(removed.Select(p => p.Key)),
        });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            var latest = await db.Roles.AsNoTracking().Where(r => r.Id == id).Select(r => r.PermissionsVersion).FirstOrDefaultAsync(ct);
            return VersionConflict(latest);
        }

        access.Invalidate();
        return TypedResults.Ok(await RoleRules.ToPermissionsDtoAsync(db, role, ct));
    }

    private static ProblemHttpResult VersionConflict(long currentVersion) =>
        Problems.Create(
            StatusCodes.Status409Conflict,
            "roles.version_conflict",
            "Права ролі вже змінив інший працівник",
            "Оновіть сторінку й внесіть зміни ще раз.",
            [new("currentVersion", currentVersion)]);
}
