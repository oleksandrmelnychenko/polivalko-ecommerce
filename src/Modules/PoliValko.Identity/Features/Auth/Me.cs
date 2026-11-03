using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Auth;

internal static class Me
{
    public static Ok<StaffMeDto> Handle(ClaimsPrincipal user) =>
        TypedResults.Ok(new StaffMeDto(
            user.FindFirstValue(ClaimTypes.Email) ?? user.Identity?.Name ?? string.Empty,
            user.StaffName(),
            user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList()));
}
