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
    public const string HintCookieName = "pv_customer_hint";

    public static CookieOptions HintCookieOptions(HttpContext http) => new()
    {
        HttpOnly = false,
        SameSite = SameSiteMode.Lax,
        Secure = http.Request.IsHttps,
        Path = "/",
        IsEssential = true,
        MaxAge = TimeSpan.FromDays(30),
    };

    public static CookieOptions HintCookieDeleteOptions(HttpContext http) => new()
    {
        HttpOnly = false,
        SameSite = SameSiteMode.Lax,
        Secure = http.Request.IsHttps,
        Path = "/",
        IsEssential = true,
    };

    public static IServiceCollection AddCustomerAuthentication(this IServiceCollection services)
    {
        services.AddSessionCookieProtection(Scheme);
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
                options.Events.OnSigningIn = context =>
                {
                    context.HttpContext.Response.Cookies.Append(HintCookieName, "1", HintCookieOptions(context.HttpContext));
                    return Task.CompletedTask;
                };
                options.Events.OnSigningOut = context =>
                {
                    context.HttpContext.Response.Cookies.Delete(HintCookieName, HintCookieDeleteOptions(context.HttpContext));
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToLogin = context => AuthProblems.WriteAsync(
                    context.HttpContext, StatusCodes.Status401Unauthorized, "auth.unauthorized", "Потрібен вхід", "Увійдіть до особистого кабінету.");
                options.Events.OnRedirectToAccessDenied = context => AuthProblems.WriteAsync(
                    context.HttpContext, StatusCodes.Status403Forbidden, "auth.forbidden", "Недостатньо прав", "Ця дія недоступна.");
                options.Events.OnValidatePrincipal = async context =>
                {
                    await CustomerSessionValidator.ValidateAsync(context);
                    if (context.Principal is not null && !string.Equals(context.HttpContext.Request.Cookies[HintCookieName], "1", StringComparison.Ordinal))
                    {
                        context.HttpContext.Response.Cookies.Append(HintCookieName, "1", HintCookieOptions(context.HttpContext));
                    }
                };
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
