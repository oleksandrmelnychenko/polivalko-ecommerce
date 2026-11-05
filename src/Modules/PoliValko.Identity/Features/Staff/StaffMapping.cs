using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Staff;

internal static class StaffMapping
{
    public static async Task<StaffUserDto> ToDtoAsync(PoliValkoDbContext db, StaffUser user, TimeProvider time, CancellationToken ct = default)
    {
        var role = await StaffRolesOf(db, user.Id).FirstOrDefaultAsync(ct);
        return new StaffUserDto(user.Id, user.Email ?? string.Empty, user.DisplayName, role?.Id ?? string.Empty, role?.DisplayName ?? string.Empty, user.LockoutEnd > time.GetUtcNow());
    }

    public static IQueryable<StaffRole> StaffRolesOf(PoliValkoDbContext db, string userId) =>
        from link in db.UserRoles
        where link.UserId == userId
        join role in db.Roles on link.RoleId equals role.Id
        orderby role.IsSuperuser descending
        select role;

    public static ProblemHttpResult UserNotFound() => Problems.NotFound("auth.user_not_found", "Працівника не знайдено");
}
