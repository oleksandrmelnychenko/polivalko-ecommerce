using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Customers.Features.Auth;

internal static class CustomerAuthentication
{
    public const string Scheme = CustomerClaims.AuthenticationType;
    public const string SelectorScheme = "PoliValko";
    public const string StaffPathPrefix = "/api/v1/console";
    public const string CookieName = "pv_customer";

    public static IServiceCollection AddCustomerAuthentication(this IServiceCollection services)
    {
        services.PostConfigure<AuthenticationOptions>(options => options.DefaultScheme = SelectorScheme);
        services.AddAuthentication()
            .AddPolicyScheme(SelectorScheme, null, options => options.ForwardDefaultSelector = SelectScheme)
            .AddCookie(Scheme, options =>
            {
                options.Cookie.Name = CookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromDays(30);
                options.SlidingExpiration = true;
                options.Events.OnRedirectToLogin = context => AuthProblems.WriteAsync(
                    context.HttpContext, StatusCodes.Status401Unauthorized, "auth.unauthorized", "Потрібен вхід", "Увійдіть до особистого кабінету.");
                options.Events.OnRedirectToAccessDenied = context => AuthProblems.WriteAsync(
                    context.HttpContext, StatusCodes.Status403Forbidden, "auth.forbidden", "Недостатньо прав", "Ця дія недоступна.");
                options.Events.OnValidatePrincipal = CustomerSessionValidator.ValidateAsync;
            });

        services.AddAuthorizationBuilder()
            .AddPolicy(CustomerPolicies.Customer, policy => policy
                .AddAuthenticationSchemes(Scheme)
                .RequireAuthenticatedUser()
                .RequireAssertion(context => context.User.CustomerId() is not null));
        return services;
    }

    private static string SelectScheme(HttpContext http) =>
        http.Request.Path.StartsWithSegments(StaffPathPrefix) ? IdentityConstants.ApplicationScheme : Scheme;
}
