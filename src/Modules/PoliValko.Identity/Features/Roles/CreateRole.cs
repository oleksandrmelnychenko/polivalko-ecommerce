using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PoliValko.Identity.Features.Staff;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Roles;

internal static class CreateRole
{
    public static async Task<Results<Created<StaffRoleDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        SaveStaffRoleRequest request,
        ClaimsPrincipal me,
        HttpContext http,
        RoleManager<StaffRole> roles,
        IStaffAccessResolver access,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var (name, description) = await RoleRules.ValidateAsync(request, null, db, errors, ct);

        IReadOnlyList<string> keys = [];
        if (!string.IsNullOrWhiteSpace(request.CopyFromRoleId))
        {
            var source = await db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == request.CopyFromRoleId, ct);
            if (source is null)
            {
                errors["copyFromRoleId"] = ["Роль, з якої копіюються права, не знайдено."];
            }
            else
            {
                keys = source.IsSuperuser
                    ? PermissionCatalog.AllKeys
                    : await db.RolePermissions.AsNoTracking().Where(p => p.RoleId == source.Id).Select(p => p.Key).ToListAsync(ct);
            }
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        if (RoleRules.Escalation(await access.GetStaffAccessAsync(me, http.Items, ct), keys) is { } denied)
        {
            return denied;
        }

        var role = new StaffRole($"role-{Guid.NewGuid():N}", name!)
        {
            Description = description,
            UpdatedAt = time.GetUtcNow(),
            UpdatedBy = me.StaffName(),
        };
        var created = await roles.CreateAsync(role);
        if (!created.Succeeded)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["name"] = created.Errors.Select(e => e.Description).ToArray() });
        }

        db.RolePermissions.AddRange(PermissionCatalog.Order(keys).Select(key => new StaffRolePermission { RoleId = role.Id, Key = key }));
        audit.Record("role.created", "StaffRole", role.Id, new { name, description, permissions = keys });
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/v1/console/roles/{role.Id}", await RoleRules.ToDtoAsync(db, role, ct));
    }
}
