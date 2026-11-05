using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Identity.Features.Staff;

internal static class ListStaffUsers
{
    public static async Task<Ok<List<StaffUserDto>>> HandleAsync(PoliValkoDbContext db, TimeProvider time, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var rows = await db.Users
            .AsNoTracking()
            .OrderBy(u => u.Email)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.DisplayName,
                u.LockoutEnd,
                Role = (from link in db.UserRoles
                        where link.UserId == u.Id
                        join role in db.Roles on link.RoleId equals role.Id
                        orderby role.IsSuperuser descending
                        select new { role.Id, role.DisplayName }).FirstOrDefault(),
            })
            .ToListAsync(ct);
        return TypedResults.Ok(rows
            .Select(u => new StaffUserDto(u.Id, u.Email ?? string.Empty, u.DisplayName, u.Role?.Id ?? string.Empty, u.Role?.DisplayName ?? string.Empty, u.LockoutEnd > now))
            .ToList());
    }
}
