using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Roles;

internal static class ListRoles
{
    public static async Task<Ok<List<StaffRoleDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var all = PermissionCatalog.Permissions.Count;
        var roles = await db.Roles
            .AsNoTracking()
            .OrderByDescending(r => r.IsSuperuser)
            .ThenByDescending(r => r.IsSystem)
            .ThenBy(r => r.DisplayName)
            .Select(r => new StaffRoleDto(
                r.Id,
                r.DisplayName,
                r.Description,
                r.IsSystem,
                r.IsSuperuser,
                db.UserRoles.Count(link => link.RoleId == r.Id),
                r.IsSuperuser ? all : r.Permissions.Count,
                r.PermissionsVersion,
                r.UpdatedAt,
                r.UpdatedBy))
            .ToListAsync(ct);
        return TypedResults.Ok(roles);
    }
}
