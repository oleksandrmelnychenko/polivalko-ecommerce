using Microsoft.AspNetCore.Identity;

namespace PoliValko.Infrastructure.Security;

public sealed class StaffUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
}
