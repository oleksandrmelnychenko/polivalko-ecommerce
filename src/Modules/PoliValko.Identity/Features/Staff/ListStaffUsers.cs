using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Staff;

internal static class ListStaffUsers
{
    public static async Task<Ok<List<StaffUserDto>>> HandleAsync(UserManager<StaffUser> userManager, TimeProvider time, CancellationToken ct)
    {
        var users = await userManager.Users.OrderBy(u => u.Email).ToListAsync(ct);
        var result = new List<StaffUserDto>(users.Count);
        foreach (var user in users)
        {
            result.Add(await StaffMapping.ToDtoAsync(userManager, user, time));
        }

        return TypedResults.Ok(result);
    }
}
