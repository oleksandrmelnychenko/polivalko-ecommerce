using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Roles;

internal static class UpdateRole
{
    public static async Task<Results<Ok<StaffRoleDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string id,
        SaveStaffRoleRequest request,
        ClaimsPrincipal me,
        PoliValkoDbContext db,
        IStaffAccessResolver access,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null)
        {
            return RoleRules.NotFound();
        }

        if (role.IsSuperuser)
        {
            return RoleRules.Superuser();
        }

        var errors = new Dictionary<string, string[]>();
        var (name, description) = await RoleRules.ValidateAsync(request, role.Id, db, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var before = new { role.DisplayName, role.Description };
        role.DisplayName = name!;
        role.Description = description;
        role.UpdatedAt = time.GetUtcNow();
        role.UpdatedBy = me.StaffName();
        audit.Record("role.updated", "StaffRole", role.Id, new { before, after = new { name, description } });
        await db.SaveChangesAsync(ct);
        access.Invalidate();
        return TypedResults.Ok(await RoleRules.ToDtoAsync(db, role, ct));
    }
}
