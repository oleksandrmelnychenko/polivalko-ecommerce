using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;

namespace PoliValko.Infrastructure.Security;

public static class SessionCookieProtection
{
    public static IServiceCollection AddSessionCookieProtection(this IServiceCollection services, string scheme)
    {
        services.AddOptions<CookieAuthenticationOptions>(scheme)
            .Configure<IDataProtectionProvider>((options, provider) =>
                // A fixed generation rejects pre-cutover sessions without revoking unrelated protected data.
                // Keep this purpose across restarts and rollbacks; never fall back to the legacy provider.
                options.DataProtectionProvider = provider.CreateProtector("PoliValko.AuthenticationSessions", "2026-11-08"));
        return services;
    }
}
