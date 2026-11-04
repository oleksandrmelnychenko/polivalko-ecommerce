using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace PoliValko.Customers.Features.Auth;

internal static class Logout
{
    public static async Task<NoContent> HandleAsync(HttpContext http, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        await CustomerSession.SignOutAsync(http);
        return TypedResults.NoContent();
    }
}
