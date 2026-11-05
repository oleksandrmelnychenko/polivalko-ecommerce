using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Identity.Features.Auth;
using PoliValko.Identity.Features.Permissions;
using PoliValko.Identity.Features.Roles;
using PoliValko.Identity.Features.Staff;
using PoliValko.Identity.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity;

public static class IdentityModule
{
    public const string CookieName = "pv_console";

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
            .AddRoles<StaffRole>()
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
            .AddPolicy(StaffPolicies.Staff, policy => policy.AddAuthenticationSchemes(IdentityConstants.ApplicationScheme).RequireAuthenticatedUser());
        services.AddHttpContextAccessor();
        services.AddMemoryCache();
        services.AddSingleton<StaffAccessEpoch>();
        services.AddScoped<IStaffAccessResolver, StaffAccessResolver>();
        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

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

    public static RouteGroupBuilder MapConsoleAuthEndpoints(this RouteGroupBuilder console) =>
        AuthEndpoints.Map(console);

    public static RouteGroupBuilder MapConsoleStaffEndpoints(this RouteGroupBuilder console)
    {
        StaffEndpoints.Map(console);
        RoleEndpoints.Map(console);
        PermissionEndpoints.Map(console);
        return console;
    }

    public static Task SeedUsersAsync(IServiceProvider services, CancellationToken ct = default) =>
        IdentitySeeder.SeedAsync(services, ct);
}
