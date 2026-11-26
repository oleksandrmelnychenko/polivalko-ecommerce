using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Fiscal.Configuration;
using PoliValko.Fiscal.Domain;
using PoliValko.Fiscal.Integrations.Providers;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Features.Settings;

/// <summary>Checkbox cash register keys for signing in, read on each call so a console change applies at once.</summary>
internal interface ICheckboxCredentials
{
    Task<CheckboxKeys?> CheckboxAsync(CancellationToken ct);
}

internal sealed record CheckboxKeys(string LicenseKey, string CashierLogin, string CashierPassword);

/// <summary>Keys typed in the console but not saved yet: used to check them before saving.</summary>
internal sealed class FixedCheckboxCredentials(CheckboxKeys keys) : ICheckboxCredentials
{
    public Task<CheckboxKeys?> CheckboxAsync(CancellationToken ct) => Task.FromResult<CheckboxKeys?>(keys);
}

/// <summary>
/// The cash register (ПРРО) and when the site issues receipts. The console saves them in <c>platform.settings</c>
/// with the license key and cashier password encrypted; until it does, <c>Fiscal:*</c> in the server configuration
/// decides. The test stub stays server-only: the console turns Checkbox on or off.
/// </summary>
internal sealed class FiscalGateway(PoliValkoDbContext db, IDataProtectionProvider protection, IOptions<FiscalOptions> options) : ICheckboxCredentials
{
    internal const string Key = "fiscal.checkbox.v1";
    internal const string Purpose = "PoliValko.Fiscal.Secrets.v1";
    public const string Checkbox = "Checkbox";
    public const string Stub = "Stub";
    public const string Disabled = "Disabled";

    internal sealed record Stored(
        Guid Revision,
        bool Enabled,
        string? ProtectedLicenseKey,
        string? CashierLogin,
        string? ProtectedPassword,
        Dictionary<PaymentMethod, ReceiptMoment> IssueOn,
        DateTimeOffset? VerifiedAt,
        string? FiscalNumber);

    internal sealed record Effective(
        string Provider,
        string? LicenseKey,
        string? CashierLogin,
        string? CashierPassword,
        IReadOnlyDictionary<PaymentMethod, ReceiptMoment> IssueOn,
        string Source,
        bool StubAvailable);

    private Effective? _loaded;

    public async Task<Stored?> ReadAsync(CancellationToken ct)
    {
        // Deliberately bypass the process-local settings cache: API and Worker see a console change at once.
        var json = await db.Set<PlatformSetting>().AsNoTracking().Where(s => s.Key == Key).Select(s => s.Value).SingleOrDefaultAsync(ct);
        return json is null ? null : JsonSerializer.Deserialize<Stored>(json);
    }

    public async Task<Effective> LoadAsync(CancellationToken ct)
    {
        if (_loaded is not null)
        {
            return _loaded;
        }

        var server = options.Value;
        var env = Normalize(server.Provider);
        var stubAvailable = env == Stub;
        var stored = await ReadAsync(ct);
        _loaded = stored is null
            ? new Effective(env, server.Checkbox.LicenseKey, server.Checkbox.CashierLogin, server.Checkbox.CashierPassword, server.IssueOn, "environment", stubAvailable)
            : new Effective(
                stored.Enabled ? Checkbox : stubAvailable ? Stub : Disabled,
                stored.ProtectedLicenseKey is { } license ? Unprotect(license) : server.Checkbox.LicenseKey,
                stored.CashierLogin ?? server.Checkbox.CashierLogin,
                stored.ProtectedPassword is { } password ? Unprotect(password) : server.Checkbox.CashierPassword,
                stored.IssueOn,
                "console",
                stubAvailable);
        return _loaded;
    }

    public async Task<CheckboxKeys?> CheckboxAsync(CancellationToken ct)
    {
        var value = await LoadAsync(ct);
        return string.IsNullOrWhiteSpace(value.LicenseKey) || string.IsNullOrWhiteSpace(value.CashierLogin) || string.IsNullOrWhiteSpace(value.CashierPassword)
            ? null
            : new CheckboxKeys(value.LicenseKey, value.CashierLogin, value.CashierPassword);
    }

    /// <summary>The provider that issues receipts now; null when fiscalisation is off.</summary>
    public async Task<IFiscalProvider?> ProviderAsync(IEnumerable<IFiscalProvider> providers, CancellationToken ct)
    {
        var name = (await LoadAsync(ct)).Provider;
        return name == Disabled ? null : providers.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
    }

    public string Protect(string secret) => protection.CreateProtector(Purpose).Protect(secret);

    public void Forget() => _loaded = null;

    internal static string Normalize(string? provider) => provider?.Trim().ToLowerInvariant() switch
    {
        "checkbox" => Checkbox,
        "stub" => Stub,
        _ => Disabled,
    };

    private string Unprotect(string value) => protection.CreateProtector(Purpose).Unprotect(value);
}
