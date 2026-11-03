using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Identity.Features.Auth;
using PoliValko.Identity.Features.Staff;
using PoliValko.Identity.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity;

public static class IdentityModule
{
    public const string CookieName = "pv_admin";

    public static IServiceCollection AddIdentityModule(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddIdentityCore<StaffUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 10;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<PoliValkoDbContext>()
            .AddSignInManager()
            .AddClaimsPrincipalFactory<StaffClaimsFactory>();

        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = CookieName;
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromHours(8);
            options.SlidingExpiration = true;
            options.Events.OnRedirectToLogin = context => AuthProblems.WriteUnauthorizedAsync(context.HttpContext);
            options.Events.OnRedirectToAccessDenied = context => AuthProblems.WriteForbiddenAsync(context.HttpContext);
        });

        services.AddAuthorizationBuilder()
            .AddPolicy(StaffPolicies.Staff, policy => policy.RequireRole(StaffRoles.All))
            .AddPolicy(StaffPolicies.Admin, policy => policy.RequireRole(StaffRoles.Admin));

        services.AddAntiforgery(options =>
        {
            options.HeaderName = CsrfHeaders.Token;
            options.Cookie.Name = "pv_csrf";
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        });

        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.FromMinutes(1));

        services.AddDataProtection().SetApplicationName("PoliValko").PersistKeysToDbContext<PoliValkoDbContext>();
        return services;
    }

    public static RouteGroupBuilder MapAdminAuthEndpoints(this RouteGroupBuilder admin) =>
        AuthEndpoints.Map(admin);

    public static RouteGroupBuilder MapAdminStaffEndpoints(this RouteGroupBuilder admin) =>
        StaffEndpoints.Map(admin);

    public static Task SeedUsersAsync(IServiceProvider services, CancellationToken ct = default) =>
        IdentitySeeder.SeedAsync(services, ct);
}
