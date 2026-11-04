using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;

namespace PoliValko.Customers.Features.Auth;

internal static class CustomerSession
{
    public static Task SignInAsync(HttpContext http, Customer customer) =>
        http.SignInAsync(
            CustomerAuthentication.Scheme,
            CreatePrincipal(customer.Id, customer.Email, customer.Name, customer.SecurityStamp),
            new AuthenticationProperties { IsPersistent = true });

    public static Task SignOutAsync(HttpContext http) => http.SignOutAsync(CustomerAuthentication.Scheme);

    public static ClaimsPrincipal CreatePrincipal(Guid id, string email, string name, string securityStamp) =>
        new(new ClaimsIdentity(
            [
                new Claim(CustomerClaims.Id, id.ToString()),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Name, name),
                new Claim(CustomerClaims.SecurityStamp, securityStamp),
            ],
            CustomerClaims.AuthenticationType));
}
