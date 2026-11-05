using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Auth;

internal static class Me
{
    public static async Task<Ok<StaffMeDto>> HandleAsync(ClaimsPrincipal user, HttpContext http, IStaffAccessResolver access, CancellationToken ct)
    {
        var mine = await access.GetStaffAccessAsync(user, http.Items, ct);
        return TypedResults.Ok(new StaffMeDto(
            user.FindFirstValue(ClaimTypes.Email) ?? user.Identity?.Name ?? string.Empty,
            user.StaffName(),
            mine?.RoleId ?? string.Empty,
            mine?.RoleName ?? string.Empty));
    }
}
