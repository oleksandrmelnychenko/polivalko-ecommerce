using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Settings;

/// <summary>A way to pay the buyer can pick: a bank's payment page, or the wallets shown on one of them.</summary>
public sealed record PaymentOption(string Code, string Name, string Hint, string Provider);

/// <summary>
/// Which banks take card payments and their keys. The console saves them in <c>platform_settings</c> with the
/// secrets encrypted; until it does, the server configuration (<c>Payments:Provider</c>, <c>Payments:Mono:Token</c>)
/// decides, so a deploy changes nothing by itself. The sandbox stays server-only: the console cannot turn it on.
/// </summary>
internal sealed class PaymentGateways(PoliValkoDbContext db, IDataProtectionProvider protection, IOptions<PaymentsOptions> options) : IPaymentCredentials
{
    internal const string Key = "payments.gateways.v1";
    internal const string Purpose = "PoliValko.Payments.Secrets.v1";
    public const string WalletCode = "wallet";

    internal sealed record MonoStored(bool Enabled, string? ProtectedToken, DateTimeOffset? VerifiedAt);

    internal sealed record LiqPayStored(bool Enabled, string? PublicKey, string? ProtectedPrivateKey, string? Signature, DateTimeOffset? VerifiedAt);

    internal sealed record WalletsStored(bool Enabled, string? Provider);

    internal sealed record Stored(Guid Revision, MonoStored Mono, LiqPayStored LiqPay, WalletsStored Wallets);

    internal sealed record Effective(
        bool SandboxEnabled,
        bool MonoEnabled,
        string? MonoToken,
        bool LiqPayEnabled,
        string? LiqPayPublicKey,
        string? LiqPayPrivateKey,
        string LiqPaySignature,
        bool WalletsEnabled,
        string WalletsProvider,
        string Source)
    {
        public bool MonoReady => MonoEnabled && !string.IsNullOrWhiteSpace(MonoToken);

        public bool LiqPayReady => LiqPayEnabled && !string.IsNullOrWhiteSpace(LiqPayPublicKey) && !string.IsNullOrWhiteSpace(LiqPayPrivateKey);
    }

    private Effective? _loaded;

    public bool SandboxEnabled =>
        options.Value.AllowSandbox && PaymentProviderNames.Is(options.Value.Provider, PaymentProviderNames.Sandbox);

    public async Task<Stored?> ReadAsync(CancellationToken ct)
    {
        // Deliberately bypass the process-local settings cache: API and Worker see a console change at once.
        var json = await db.Set<PlatformSetting>().AsNoTracking().Where(s => s.Key == Key).Select(s => s.Value).SingleOrDefaultAsync(ct);
        return json is null ? null : JsonSerializer.Deserialize<Stored>(json);
    }

    /// <summary>The settings in force, secrets decrypted. Cached for the request or job run that asked.</summary>
    public async Task<Effective> LoadAsync(CancellationToken ct)
    {
        if (_loaded is not null)
        {
            return _loaded;
        }

        var stored = await ReadAsync(ct);
        var server = options.Value;
        var envMono = PaymentProviderNames.Is(server.Provider, PaymentProviderNames.Mono);
        _loaded = stored is null
            ? new Effective(SandboxEnabled, envMono, server.Mono.Token, false, null, null, LiqPaySignatures.Sha1, false, PaymentProviderNames.Mono, "environment")
            : new Effective(
                SandboxEnabled,
                stored.Mono.Enabled,
                stored.Mono.ProtectedToken is { } token ? Unprotect(token) : server.Mono.Token,
                stored.LiqPay.Enabled,
                stored.LiqPay.PublicKey,
                stored.LiqPay.ProtectedPrivateKey is { } key ? Unprotect(key) : null,
                stored.LiqPay.Signature ?? LiqPaySignatures.Sha1,
                stored.Wallets.Enabled,
                stored.Wallets.Provider ?? PaymentProviderNames.Mono,
                "console");
        return _loaded;
    }

    /// <summary>What the buyer can choose, in the order shown. Empty when online payment is off.</summary>
    public async Task<IReadOnlyList<PaymentOption>> OptionsAsync(CancellationToken ct)
    {
        var value = await LoadAsync(ct);
        var result = new List<PaymentOption>(4);
        if (value.SandboxEnabled)
        {
            result.Add(new(PaymentProviderNames.Sandbox, "Тестова оплата", "Без реальних грошей", PaymentProviderNames.Sandbox));
        }

        if (value.MonoReady)
        {
            result.Add(new(PaymentProviderNames.Mono, "monobank", "Картка будь-якого банку", PaymentProviderNames.Mono));
        }

        if (value.LiqPayReady)
        {
            result.Add(new(PaymentProviderNames.LiqPay, "ПриватБанк", "Картка, Приват24", PaymentProviderNames.LiqPay));
        }

        var walletProvider = value.WalletsProvider;
        if (value.WalletsEnabled && result.Any(o => o.Provider == walletProvider && o.Provider != PaymentProviderNames.Sandbox))
        {
            result.Add(new(WalletCode, "Apple Pay / Google Pay", "Оплата з телефона в один дотик", walletProvider));
        }

        return result;
    }

    /// <summary>The option the buyer picked, or the first one when the request names none (older clients).</summary>
    public async Task<PaymentOption?> ResolveAsync(string? code, CancellationToken ct)
    {
        var all = await OptionsAsync(ct);
        return string.IsNullOrWhiteSpace(code)
            ? all.FirstOrDefault()
            : all.FirstOrDefault(o => string.Equals(o.Code, code.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public async Task<string?> MonoTokenAsync(CancellationToken ct) => (await LoadAsync(ct)).MonoToken;

    public async Task<LiqPayKeys?> LiqPayAsync(CancellationToken ct)
    {
        var value = await LoadAsync(ct);
        return string.IsNullOrWhiteSpace(value.LiqPayPublicKey) || string.IsNullOrWhiteSpace(value.LiqPayPrivateKey)
            ? null
            : new LiqPayKeys(value.LiqPayPublicKey, value.LiqPayPrivateKey, value.LiqPaySignature);
    }

    public string Protect(string secret) => protection.CreateProtector(Purpose).Protect(secret);

    public void Forget() => _loaded = null;

    private string Unprotect(string value) => protection.CreateProtector(Purpose).Unprotect(value);
}

public static class LiqPaySignatures
{
    public const string Sha1 = "sha1";
    public const string Sha3 = "sha3-256";
}
