using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Roles;

internal static class DeleteRole
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        string id,
        RoleManager<StaffRole> roles,
        PoliValkoDbContext db,
        IStaffAccessResolver access,
        IAuditLog audit,
        CancellationToken ct)
    {
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null)
        {
            return RoleRules.NotFound();
        }

        if (role.IsSystem)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "roles.system", "Системну роль не можна видалити");
        }

        var users = await db.UserRoles.CountAsync(link => link.RoleId == role.Id, ct);
        if (users > 0)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "roles.in_use",
                "Роль призначено працівникам",
                $"Спершу змініть роль у працівників ({users}).",
                [new("userCount", users)]);
        }

        audit.Record("role.deleted", "StaffRole", role.Id, new { name = role.DisplayName });
        await db.SaveChangesAsync(ct);
        await roles.DeleteAsync(role);
        access.Invalidate();
        return TypedResults.NoContent();
    }
}
