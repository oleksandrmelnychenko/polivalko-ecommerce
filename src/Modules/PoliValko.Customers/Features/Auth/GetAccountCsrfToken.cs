using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Customers.Features.Auth;

internal static class GetAccountCsrfToken
{
    public static Ok<CsrfTokenDto> Handle(HttpContext http, IAntiforgery antiforgery) =>
        TypedResults.Ok(new CsrfTokenDto(antiforgery.GetAndStoreTokens(http).RequestToken!));
}
