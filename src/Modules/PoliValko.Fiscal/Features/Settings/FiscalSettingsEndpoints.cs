using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Fiscal.Configuration;
using PoliValko.Fiscal.Domain;
using PoliValko.Fiscal.Integrations.Checkbox;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Features.Settings;

/// <param name="Card">When the site issues the sale receipt: <c>payment</c>, <c>completion</c> or <c>none</c>.</param>
public sealed record ReceiptMomentsDto(string Card, string CashOnDelivery, string Pickup);

/// <param name="Provider"><c>Checkbox</c>, <c>Stub</c> (test servers only) or <c>Disabled</c>.</param>
/// <param name="Source"><c>console</c> once saved here; <c>environment</c> while the server configuration still decides.</param>
public sealed record FiscalGatewayDto(
    Guid? Revision,
    string Source,
    string Provider,
    bool StubAvailable,
    bool Enabled,
    bool HasLicenseKey,
    string? CashierLogin,
    bool HasPassword,
    DateTimeOffset? VerifiedAt,
    string? FiscalNumber,
    ReceiptMomentsDto IssueOn);

/// <summary>Empty key fields keep the saved ones; <c>ClearKeys</c> removes them (only with the register switched off).</summary>
public sealed record SaveFiscalSettingsRequest(
    Guid? Revision,
    bool Enabled,
    string? LicenseKey,
    string? CashierLogin,
    string? CashierPassword,
    bool ClearKeys,
    ReceiptMomentsDto IssueOn);

/// <summary>Checks typed keys without saving them; empty fields check the saved ones.</summary>
public sealed record CheckFiscalRequest(string? LicenseKey, string? CashierLogin, string? CashierPassword);

public sealed record CheckFiscalDto(string FiscalNumber, string Message);

internal static class FiscalSettingsEndpoints
{
    public const string CheckClient = "fiscal.check";

    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/settings/fiscal").WithTags("Console").RequireStaff(PermissionKeys.SettingsPaymentsManage);
        group.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });
        group.MapGet(string.Empty, GetAsync)
            .WithName("ConsoleGetFiscalSettings")
            .WithSummary("Каса Checkbox (ПРРО) і коли сайт видає чек. Ключ ліцензії й пароль касира не повертаються.")
            .Produces<FiscalGatewayDto>();
        group.MapPost("/check", CheckAsync)
            .WithName("ConsoleCheckFiscal")
            .WithSummary("Перевірити ключі Checkbox: вхід касира й каса за ключем ліцензії, нічого не зберігаючи")
            .Produces<CheckFiscalDto>()
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .RequireRateLimiting(RateLimitPolicies.Forms);
        group.MapPut(string.Empty, SaveAsync)
            .WithName("ConsoleSaveFiscalSettings")
            .WithSummary("Зберегти касу й моменти видачі чека. Ключі ввімкненої каси спершу перевіряються в Checkbox; секрети шифруються.")
            .Produces<FiscalGatewayDto>()
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .RequireRateLimiting(RateLimitPolicies.Forms);
        return console;
    }

    private static async Task<FiscalGatewayDto> DtoAsync(FiscalGateway gateway, CancellationToken ct)
    {
        gateway.Forget();
        var stored = await gateway.ReadAsync(ct);
        var value = await gateway.LoadAsync(ct);
        return new FiscalGatewayDto(
            stored?.Revision,
            value.Source,
            value.Provider,
            value.StubAvailable,
            value.Provider == FiscalGateway.Checkbox,
            !string.IsNullOrWhiteSpace(value.LicenseKey),
            value.CashierLogin,
            !string.IsNullOrWhiteSpace(value.CashierPassword),
            stored?.VerifiedAt,
            stored?.FiscalNumber,
            new ReceiptMomentsDto(
                FiscalSettings.MomentCode(value.IssueOn.GetValueOrDefault(PaymentMethod.Card, ReceiptMoment.None)),
                FiscalSettings.MomentCode(value.IssueOn.GetValueOrDefault(PaymentMethod.CashOnDelivery, ReceiptMoment.None)),
                FiscalSettings.MomentCode(value.IssueOn.GetValueOrDefault(PaymentMethod.PayOnPickup, ReceiptMoment.None))));
    }

    private static async Task<IResult> GetAsync(FiscalGateway gateway, CancellationToken ct) => Results.Ok(await DtoAsync(gateway, ct));

    private static async Task<IResult> CheckAsync(CheckFiscalRequest request, FiscalGateway gateway, IHttpClientFactory http, IOptions<FiscalOptions> options, CancellationToken ct)
    {
        if (Invalid(request.LicenseKey, request.CashierLogin, request.CashierPassword) is { } invalid) return invalid;
        var current = await gateway.LoadAsync(ct);
        var keys = Keys(request.LicenseKey, request.CashierLogin, request.CashierPassword, current);
        if (keys is null) return Problem("licenseKey", "Вставте ключ ліцензії каси, логін і пароль касира.");
        try
        {
            var number = await Checkbox(http, options, keys).CheckAsync(ct);
            return Results.Ok(new CheckFiscalDto(number, $"Checkbox прийняв ключі: каса {number}."));
        }
        catch (Exception ex) when (IsConnectionFailure(ex, ct))
        {
            return ConnectionError();
        }
    }

    private static async Task<IResult> SaveAsync(
        SaveFiscalSettingsRequest request,
        FiscalGateway gateway,
        IHttpClientFactory http,
        IOptions<FiscalOptions> options,
        PoliValkoDbContext db,
        IAuditLog audit,
        HttpContext context,
        TimeProvider time,
        CancellationToken ct)
    {
        if (Invalid(request.LicenseKey, request.CashierLogin, request.CashierPassword) is { } invalid) return invalid;
        if (request.ClearKeys && (request.Enabled || !Blank(request.LicenseKey) || !Blank(request.CashierPassword)))
            return Problem("licenseKey", "Щоб видалити ключі, вимкніть касу й залиште поля порожніми.");
        if (Moments(request.IssueOn) is not { } issueOn)
            return Problem("issueOn", "Оберіть, коли видавати чек: після оплати карткою, після виконання замовлення або не видавати.");

        if ((await gateway.ReadAsync(ct))?.Revision != request.Revision) return Conflict();
        var current = await gateway.LoadAsync(ct);
        var keys = request.ClearKeys ? null : Keys(request.LicenseKey, request.CashierLogin, request.CashierPassword, current);
        DateTimeOffset? verified = null;
        string? fiscalNumber = null;
        if (request.Enabled)
        {
            if (keys is null) return Problem("licenseKey", "Вставте ключ ліцензії каси, логін і пароль касира.");
            try
            {
                fiscalNumber = await Checkbox(http, options, keys).CheckAsync(ct);
                verified = time.GetUtcNow();
            }
            catch (Exception ex) when (IsConnectionFailure(ex, ct))
            {
                return ConnectionError();
            }
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Two managers saving at once: the second one waits here and then sees the first one's revision.
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({FiscalGateway.Key}, 0))", ct);
        if ((await gateway.ReadAsync(ct))?.Revision != request.Revision) return Conflict();

        var login = request.ClearKeys ? null : Blank(request.CashierLogin) ? current.CashierLogin : request.CashierLogin!.Trim();
        var license = request.ClearKeys ? null : Blank(request.LicenseKey) ? current.LicenseKey : request.LicenseKey!.Trim();
        var password = request.ClearKeys ? null : Blank(request.CashierPassword) ? current.CashierPassword : request.CashierPassword!;
        var value = new FiscalGateway.Stored(
            Guid.NewGuid(),
            request.Enabled,
            string.IsNullOrWhiteSpace(license) ? null : gateway.Protect(license),
            string.IsNullOrWhiteSpace(login) ? null : login,
            string.IsNullOrEmpty(password) ? null : gateway.Protect(password),
            issueOn,
            verified,
            fiscalNumber);
        var row = await db.Set<PlatformSetting>().SingleOrDefaultAsync(s => s.Key == FiscalGateway.Key, ct);
        if (row is null)
        {
            row = new PlatformSetting { Key = FiscalGateway.Key, Value = "", UpdatedBy = context.User.StaffName() };
            db.Add(row);
        }

        row.Value = JsonSerializer.Serialize(value);
        row.UpdatedAt = time.GetUtcNow();
        row.UpdatedBy = context.User.StaffName();
        audit.Record("settings.fiscal_updated", "FiscalSettings", null, new
        {
            enabled = request.Enabled,
            issueOn = request.IssueOn,
            keysChanged = !Blank(request.LicenseKey) || !Blank(request.CashierLogin) || !Blank(request.CashierPassword) || request.ClearKeys,
        });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(await DtoAsync(gateway, ct));
    }

    /// <summary>
    /// A sale receipt is issued after a card payment, or when the order is completed. Cash on delivery and pickup have
    /// no online payment, so for them "after payment" cannot happen.
    /// </summary>
    private static Dictionary<PaymentMethod, ReceiptMoment>? Moments(ReceiptMomentsDto? dto)
    {
        if (dto is null) return null;
        var card = Parse(dto.Card);
        var cod = Parse(dto.CashOnDelivery);
        var pickup = Parse(dto.Pickup);
        if (card is null || cod is null or ReceiptMoment.Payment || pickup is null or ReceiptMoment.Payment) return null;
        return new() { [PaymentMethod.Card] = card.Value, [PaymentMethod.CashOnDelivery] = cod.Value, [PaymentMethod.PayOnPickup] = pickup.Value };

        static ReceiptMoment? Parse(string? code) => code?.Trim().ToLowerInvariant() switch
        {
            "payment" => ReceiptMoment.Payment,
            "completion" => ReceiptMoment.Completion,
            "none" => ReceiptMoment.None,
            _ => null,
        };
    }

    private static CheckboxKeys? Keys(string? license, string? login, string? password, FiscalGateway.Effective current)
    {
        var l = Blank(license) ? current.LicenseKey : license!.Trim();
        var c = Blank(login) ? current.CashierLogin : login!.Trim();
        var p = Blank(password) ? current.CashierPassword : password;
        return string.IsNullOrWhiteSpace(l) || string.IsNullOrWhiteSpace(c) || string.IsNullOrEmpty(p) ? null : new CheckboxKeys(l, c, p);
    }

    private static CheckboxFiscalProvider Checkbox(IHttpClientFactory http, IOptions<FiscalOptions> options, CheckboxKeys keys) =>
        new(http.CreateClient(CheckClient), options, new FixedCheckboxCredentials(keys));

    private static IResult? Invalid(string? license, string? login, string? password)
    {
        if (!ValidKey(license)) return Problem("licenseKey", "Некоректний формат ключа ліцензії.");
        if (login is { Length: > 200 }) return Problem("cashierLogin", "Логін касира задовгий.");
        if (password is { Length: > 200 }) return Problem("cashierPassword", "Пароль касира задовгий.");
        return null;
    }

    private static bool Blank(string? value) => string.IsNullOrWhiteSpace(value);

    private static bool ValidKey(string? key) => key is null || (key.Trim().Length <= 512 && key.Trim().All(c => c >= '!' && c <= '~'));

    private static IResult Problem(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private static IResult Conflict() =>
        Problems.Create(409, "fiscal.settings_changed", "Налаштування вже змінено", "Оновіть сторінку й повторіть зміну.");

    private static IResult ConnectionError() =>
        Problems.Create(502, "fiscal.connection_failed", "Checkbox не прийняв ключі",
            "Перевірте ключ ліцензії каси, логін і пароль касира в кабінеті Checkbox. Збережені налаштування не змінено.");

    private static bool IsConnectionFailure(Exception ex, CancellationToken ct) =>
        ex is HttpRequestException or JsonException or InvalidOperationException or CryptographicException
        || ex is OperationCanceledException && !ct.IsCancellationRequested;
}
