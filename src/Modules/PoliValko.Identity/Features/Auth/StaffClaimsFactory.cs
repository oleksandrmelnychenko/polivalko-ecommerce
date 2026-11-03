using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Auth;

internal sealed class StaffClaimsFactory(
    UserManager<StaffUser> userManager,
    RoleManager<IdentityRole> roleManager,
    IOptions<IdentityOptions> options)
    : UserClaimsPrincipalFactory<StaffUser, IdentityRole>(userManager, roleManager, options)
{
    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(StaffUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        identity.AddClaim(new Claim(StaffClaims.DisplayName, user.DisplayName));
        return identity;
    }
}
