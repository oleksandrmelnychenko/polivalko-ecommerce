using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Web;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Features.Checkout;
using PoliValko.Payments.Integrations.LiqPay;
using PoliValko.Payments.Integrations.Mono;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Settings;

public sealed record MonoGatewayDto(bool Enabled, bool HasToken, DateTimeOffset? VerifiedAt);

public sealed record LiqPayGatewayDto(bool Enabled, string? PublicKey, bool HasPrivateKey, string Signature, DateTimeOffset? VerifiedAt);

public sealed record WalletsGatewayDto(bool Enabled, string Provider);

/// <param name="Source"><c>console</c> once saved here; <c>environment</c> while the server configuration still decides.</param>
public sealed record PaymentGatewaysDto(
    Guid? Revision,
    string Source,
    bool SandboxEnabled,
    MonoGatewayDto Mono,
    LiqPayGatewayDto LiqPay,
    WalletsGatewayDto Wallets,
    IReadOnlyList<PaymentOptionDto> Options);

/// <summary>Empty key fields keep the saved key; <c>Clear…</c> removes it (only with that bank switched off).</summary>
public sealed record SavePaymentGatewaysRequest(
    Guid? Revision,
    bool MonoEnabled,
    string? MonoToken,
    bool ClearMonoToken,
    bool LiqPayEnabled,
    string? LiqPayPublicKey,
    string? LiqPayPrivateKey,
    bool ClearLiqPayKeys,
    bool WalletsEnabled,
    string? WalletsProvider);

/// <summary>Checks typed keys without saving them; empty fields check the saved ones.</summary>
public sealed record CheckPaymentGatewayRequest(string? Provider, string? MonoToken, string? LiqPayPublicKey, string? LiqPayPrivateKey);

public sealed record CheckPaymentGatewayDto(string Provider, string Message);

internal static class PaymentGatewayEndpoints
{
    public const string CheckClient = "payments.check";

    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/settings/payments/gateways").WithTags("Console").RequireStaff(PermissionKeys.SettingsPaymentsManage);
        group.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });
        group.MapGet(string.Empty, GetAsync)
            .WithName("ConsoleGetPaymentGateways")
            .WithSummary("Банки онлайн-оплати: monobank, LiqPay (ПриватБанк), Apple Pay і Google Pay. Ключі не повертаються, лише чи вони збережені.")
            .Produces<PaymentGatewaysDto>();
        group.MapPost("/check", CheckAsync)
            .WithName("ConsoleCheckPaymentGateway")
            .WithSummary("Перевірити ключі банку запитом до нього, нічого не зберігаючи")
            .Produces<CheckPaymentGatewayDto>()
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .RequireRateLimiting(RateLimitPolicies.Forms);
        group.MapPut(string.Empty, SaveAsync)
            .WithName("ConsoleSavePaymentGateways")
            .WithSummary("Зберегти банки й ключі. Ключі ввімкненого банку спершу перевіряються в банку; ключі шифруються.")
            .Produces<PaymentGatewaysDto>()
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .RequireRateLimiting(RateLimitPolicies.Forms);
        return console;
    }

    private static async Task<PaymentGatewaysDto> DtoAsync(PaymentGateways gateways, CancellationToken ct)
    {
        gateways.Forget();
        var stored = await gateways.ReadAsync(ct);
        var value = await gateways.LoadAsync(ct);
        var options = (await gateways.OptionsAsync(ct)).Select(o => new PaymentOptionDto(o.Code, o.Name, o.Hint)).ToList();
        return new PaymentGatewaysDto(
            stored?.Revision,
            value.Source,
            value.SandboxEnabled,
            new MonoGatewayDto(value.MonoEnabled, !string.IsNullOrWhiteSpace(value.MonoToken), stored?.Mono.VerifiedAt),
            new LiqPayGatewayDto(value.LiqPayEnabled, value.LiqPayPublicKey, !string.IsNullOrWhiteSpace(value.LiqPayPrivateKey), value.LiqPaySignature, stored?.LiqPay.VerifiedAt),
            new WalletsGatewayDto(value.WalletsEnabled, value.WalletsProvider),
            options);
    }

    private static async Task<IResult> GetAsync(PaymentGateways gateways, CancellationToken ct) => Results.Ok(await DtoAsync(gateways, ct));

    private static async Task<IResult> CheckAsync(
        CheckPaymentGatewayRequest request, PaymentGateways gateways, IHttpClientFactory http, IOptions<PaymentsOptions> options, MonoWebhookKeys keys, CancellationToken ct)
    {
        var current = await gateways.LoadAsync(ct);
        try
        {
            if (PaymentProviderNames.Is(request.Provider, PaymentProviderNames.Mono))
            {
                if (!ValidKey(request.MonoToken)) return Invalid("monoToken", "Некоректний формат токена.");
                var token = Blank(request.MonoToken) ? current.MonoToken : request.MonoToken!.Trim();
                if (string.IsNullOrWhiteSpace(token)) return Invalid("monoToken", "Вставте токен monobank.");
                var merchant = await Mono(http, options, keys, token).CheckAsync(ct);
                return Results.Ok(new CheckPaymentGatewayDto(PaymentProviderNames.Mono, $"Підключено: {merchant}"));
            }

            if (PaymentProviderNames.Is(request.Provider, PaymentProviderNames.LiqPay))
            {
                if (!ValidKey(request.LiqPayPublicKey)) return Invalid("liqPayPublicKey", "Некоректний формат ключа.");
                if (!ValidKey(request.LiqPayPrivateKey)) return Invalid("liqPayPrivateKey", "Некоректний формат ключа.");
                var publicKey = Blank(request.LiqPayPublicKey) ? current.LiqPayPublicKey : request.LiqPayPublicKey!.Trim();
                var privateKey = Blank(request.LiqPayPrivateKey) ? current.LiqPayPrivateKey : request.LiqPayPrivateKey!.Trim();
                if (string.IsNullOrWhiteSpace(publicKey)) return Invalid("liqPayPublicKey", "Вставте публічний ключ LiqPay.");
                if (string.IsNullOrWhiteSpace(privateKey)) return Invalid("liqPayPrivateKey", "Вставте приватний ключ LiqPay.");
                await LiqPay(http, options, new LiqPayKeys(publicKey, privateKey, current.LiqPaySignature)).CheckAsync(ct);
                var sandbox = publicKey.StartsWith("sandbox_", StringComparison.Ordinal) ? " Це тестові ключі (sandbox_): гроші не списуються." : "";
                return Results.Ok(new CheckPaymentGatewayDto(PaymentProviderNames.LiqPay, $"LiqPay прийняв ключі.{sandbox}"));
            }

            return Invalid("provider", "Оберіть mono або liqpay.");
        }
        catch (Exception ex) when (IsConnectionFailure(ex, ct))
        {
            return ConnectionError(request.Provider, ex);
        }
    }

    private static async Task<IResult> SaveAsync(
        SavePaymentGatewaysRequest request,
        PaymentGateways gateways,
        IHttpClientFactory http,
        IOptions<PaymentsOptions> options,
        MonoWebhookKeys keys,
        PoliValkoDbContext db,
        IAuditLog audit,
        HttpContext context,
        TimeProvider time,
        CancellationToken ct)
    {
        if (!ValidKey(request.MonoToken)) return Invalid("monoToken", "Некоректний формат токена.");
        if (!ValidKey(request.LiqPayPublicKey)) return Invalid("liqPayPublicKey", "Некоректний формат ключа.");
        if (!ValidKey(request.LiqPayPrivateKey)) return Invalid("liqPayPrivateKey", "Некоректний формат ключа.");
        if (request.ClearMonoToken && (request.MonoEnabled || !Blank(request.MonoToken)))
            return Invalid("monoToken", "Щоб видалити токен, вимкніть monobank і залиште поле порожнім.");
        if (request.ClearLiqPayKeys && (request.LiqPayEnabled || !Blank(request.LiqPayPublicKey) || !Blank(request.LiqPayPrivateKey)))
            return Invalid("liqPayPrivateKey", "Щоб видалити ключі, вимкніть ПриватБанк і залиште поля порожніми.");

        var walletsProvider = request.WalletsProvider?.Trim().ToLowerInvariant() ?? PaymentProviderNames.Mono;
        if (walletsProvider is not (PaymentProviderNames.Mono or PaymentProviderNames.LiqPay))
            return Invalid("walletsProvider", "Apple Pay і Google Pay працюють через monobank або ПриватБанк.");
        if (request.WalletsEnabled && !(walletsProvider == PaymentProviderNames.Mono ? request.MonoEnabled : request.LiqPayEnabled))
            return Invalid("walletsProvider", "Увімкніть банк, через який працюватимуть Apple Pay і Google Pay.");

        var current = await gateways.ReadAsync(ct);
        if (current?.Revision != request.Revision) return Conflict();
        var loaded = await gateways.LoadAsync(ct);

        var monoToken = request.ClearMonoToken ? null : Blank(request.MonoToken) ? loaded.MonoToken : request.MonoToken!.Trim();
        var publicKey = request.ClearLiqPayKeys ? null : Blank(request.LiqPayPublicKey) ? loaded.LiqPayPublicKey : request.LiqPayPublicKey!.Trim();
        var privateKey = request.ClearLiqPayKeys ? null : Blank(request.LiqPayPrivateKey) ? loaded.LiqPayPrivateKey : request.LiqPayPrivateKey!.Trim();
        var signature = loaded.LiqPaySignature;
        DateTimeOffset? monoVerified = null, liqPayVerified = null;
        try
        {
            if (request.MonoEnabled)
            {
                if (string.IsNullOrWhiteSpace(monoToken)) return Invalid("monoToken", "Вставте токен monobank.");
                await Mono(http, options, keys, monoToken).CheckAsync(ct);
                monoVerified = time.GetUtcNow();
            }
        }
        catch (Exception ex) when (IsConnectionFailure(ex, ct))
        {
            return ConnectionError(PaymentProviderNames.Mono, ex);
        }

        try
        {
            if (request.LiqPayEnabled)
            {
                if (string.IsNullOrWhiteSpace(publicKey)) return Invalid("liqPayPublicKey", "Вставте публічний ключ LiqPay.");
                if (string.IsNullOrWhiteSpace(privateKey)) return Invalid("liqPayPrivateKey", "Вставте приватний ключ LiqPay.");
                signature = await LiqPay(http, options, new LiqPayKeys(publicKey, privateKey, signature)).CheckAsync(ct);
                liqPayVerified = time.GetUtcNow();
            }
        }
        catch (Exception ex) when (IsConnectionFailure(ex, ct))
        {
            return ConnectionError(PaymentProviderNames.LiqPay, ex);
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Two managers saving at once: the second one waits here and then sees the first one's revision.
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({PaymentGateways.Key}, 0))", ct);
        if ((await gateways.ReadAsync(ct))?.Revision != request.Revision) return Conflict();
        var row = await db.Set<PlatformSetting>().SingleOrDefaultAsync(s => s.Key == PaymentGateways.Key, ct);

        var value = new PaymentGateways.Stored(
            Guid.NewGuid(),
            new PaymentGateways.MonoStored(request.MonoEnabled, string.IsNullOrWhiteSpace(monoToken) ? null : gateways.Protect(monoToken), monoVerified),
            new PaymentGateways.LiqPayStored(
                request.LiqPayEnabled,
                string.IsNullOrWhiteSpace(publicKey) ? null : publicKey,
                string.IsNullOrWhiteSpace(privateKey) ? null : gateways.Protect(privateKey),
                signature,
                liqPayVerified),
            new PaymentGateways.WalletsStored(request.WalletsEnabled, walletsProvider));
        if (row is null)
        {
            row = new PlatformSetting { Key = PaymentGateways.Key, Value = "", UpdatedBy = context.User.StaffName() };
            db.Add(row);
        }

        row.Value = JsonSerializer.Serialize(value);
        row.UpdatedAt = time.GetUtcNow();
        row.UpdatedBy = context.User.StaffName();
        audit.Record("settings.payments_updated", "PaymentSettings", null, new
        {
            monoEnabled = request.MonoEnabled,
            liqPayEnabled = request.LiqPayEnabled,
            walletsEnabled = request.WalletsEnabled,
            walletsProvider,
            monoTokenChanged = !Blank(request.MonoToken) || request.ClearMonoToken,
            liqPayKeysChanged = !Blank(request.LiqPayPublicKey) || !Blank(request.LiqPayPrivateKey) || request.ClearLiqPayKeys,
        });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(await DtoAsync(gateways, ct));
    }

    private static MonoPaymentProvider Mono(IHttpClientFactory http, IOptions<PaymentsOptions> options, MonoWebhookKeys keys, string token) =>
        new(http.CreateClient(CheckClient), options, keys, new FixedPaymentCredentials(token, null));

    private static LiqPayPaymentProvider LiqPay(IHttpClientFactory http, IOptions<PaymentsOptions> options, LiqPayKeys keys) =>
        new(http.CreateClient(CheckClient), options, new FixedPaymentCredentials(null, keys));

    private static bool Blank(string? value) => string.IsNullOrWhiteSpace(value);

    private static bool ValidKey(string? key) => key is null || (key.Trim().Length <= 2048 && key.Trim().All(c => c >= '!' && c <= '~'));

    private static IResult Invalid(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private static IResult Conflict() =>
        Problems.Create(409, "payments.settings_changed", "Налаштування вже змінено", "Оновіть сторінку й повторіть зміну.");

    private static IResult ConnectionError(string? provider, Exception ex)
    {
        var bank = PaymentProviderNames.Is(provider, PaymentProviderNames.LiqPay) ? "LiqPay (ПриватБанк)" : "monobank";
        var detail = ex is LiqPayRejectedException ? $"Відповідь банку: {ex.Message}. " : "";
        return Problems.Create(502, "payments.connection_failed", $"{bank} не прийняв ключі",
            $"{detail}Перевірте ключі в кабінеті банку. Збережені налаштування не змінено.");
    }

    private static bool IsConnectionFailure(Exception ex, CancellationToken ct) =>
        ex is HttpRequestException or JsonException or InvalidOperationException or CryptographicException
        || ex is OperationCanceledException && !ct.IsCancellationRequested;
}
