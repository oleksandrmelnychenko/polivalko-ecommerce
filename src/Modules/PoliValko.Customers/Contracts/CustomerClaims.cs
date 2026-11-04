using System.Security.Claims;

namespace PoliValko.Customers.Contracts;

public static class CustomerClaims
{
    public const string AuthenticationType = "Customer";

    public const string Id = ClaimTypes.NameIdentifier;

    public const string SecurityStamp = "customer_stamp";

    public static Guid? CustomerId(this ClaimsPrincipal? user)
    {
        var identity = user?.Identities.FirstOrDefault(i => i.IsAuthenticated && i.AuthenticationType == AuthenticationType);
        return Guid.TryParse(identity?.FindFirst(Id)?.Value, out var id) ? id : null;
    }
}
