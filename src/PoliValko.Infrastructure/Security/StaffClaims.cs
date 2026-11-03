namespace PoliValko.Infrastructure.Security;

public static class StaffClaims
{
    public const string DisplayName = "display_name";

    public static string StaffName(this System.Security.Claims.ClaimsPrincipal user) =>
        user.FindFirst(DisplayName)?.Value is { Length: > 0 } name ? name : user.Identity?.Name ?? "Працівник";
}
