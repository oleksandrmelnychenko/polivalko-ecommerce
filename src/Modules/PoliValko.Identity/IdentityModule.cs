using System.Security.Claims;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity;

public static class IdentityModule
{
    public const string CookieName = "pv_admin";
    public const string LoginRateLimitPolicy = "login";

    /// <summary>
    /// Облікові записи працівників на ASP.NET Core Identity: cookie HttpOnly + SameSite=Strict,
    /// antiforgery-заголовок для змінних запитів, блокування після 5 невдалих спроб (розділи 2, 9, 10 ТЗ).
    /// </summary>
    public static IServiceCollection AddIdentityModule(this IServiceCollection services)
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
            // Лише заміна редиректів: перевірку security stamp з подій Identity залишаємо.
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

        // Блокування, зміна ролі й скидання пароля діють на відкриті сесії протягом хвилини.
        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.FromMinutes(1));

        // Ключі в БД: cookie входу переживають перезапуски й працюють на кількох екземплярах API.
        services.AddDataProtection().SetApplicationName("PoliValko").PersistKeysToDbContext<PoliValkoDbContext>();
        return services;
    }
}

/// <summary>Додає ім'я працівника в cookie, щоб журнал змін не ходив щоразу в БД.</summary>
internal sealed class StaffClaimsFactory(
    UserManager<StaffUser> userManager,
    RoleManager<IdentityRole> roleManager,
    IOptions<IdentityOptions> options)
    : UserClaimsPrincipalFactory<StaffUser, IdentityRole>(userManager, roleManager, options)
{
    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(StaffUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        identity.AddClaim(new Claim(StaffClaims.DisplayName, user.DisplayName));
        return identity;
    }
}
