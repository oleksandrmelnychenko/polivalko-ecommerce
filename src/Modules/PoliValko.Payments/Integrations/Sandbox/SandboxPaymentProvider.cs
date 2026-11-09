using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Integrations.Sandbox;

internal sealed class SandboxPaymentProvider(
    PoliValkoDbContext db,
    IOptions<PaymentsOptions> options,
    IOptions<SiteOptions> site,
    TimeProvider time) : IPaymentProvider
{
    public const string SignatureHeader = "X-Sandbox-Signature";

    internal sealed record SandboxWebhook(string InvoiceId, string Status, string Amount, DateTimeOffset ModifiedDate);

    public string Name => PaymentProviderNames.Sandbox;

    // The test invoice keeps only the refunded total, not which references it came from.
    public bool CanFindRefunds => false;

    public async Task<CreatedInvoice> CreateInvoiceAsync(InvoiceRequest request, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var invoice = new SandboxInvoice
        {
            Id = $"sbx_{request.PaymentId:N}",
            OrderNumber = request.OrderNumber,
            Amount = request.Amount,
            Status = "created",
            RedirectUrl = request.RedirectUrl,
            CreatedAt = now,
            ModifiedAt = now,
            ExpiresAt = request.ExpiresAt,
        };
        db.Add(invoice);
        await db.SaveChangesAsync(ct);
        return new CreatedInvoice(invoice.Id, site.Value.Url($"/pay/sandbox/{invoice.Id}"));
    }

    public async Task<ProviderPaymentStatus> GetStatusAsync(string providerPaymentId, CancellationToken ct)
    {
        var invoice = await db.Set<SandboxInvoice>().FirstOrDefaultAsync(i => i.Id == providerPaymentId, ct)
            ?? throw new InvalidOperationException($"Тестовий рахунок {providerPaymentId} не знайдено.");
        if (invoice.Status is "created" or "processing" && time.GetUtcNow() > invoice.ExpiresAt)
        {
            invoice.Status = "expired";
            invoice.ModifiedAt = invoice.ExpiresAt;
            await db.SaveChangesAsync(ct);
        }

        return ToStatus(invoice);
    }

    public Task<ProviderPaymentStatus> ParseWebhookAsync(byte[] body, IHeaderDictionary headers, CancellationToken ct)
    {
        var expected = Sign(body);
        var actual = headers[SignatureHeader].ToString();
        if (actual.Length == 0 || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(actual)))
        {
            throw new PaymentWebhookRejectedException("Невірний підпис тестового повідомлення.");
        }

        var message = JsonSerializer.Deserialize<SandboxWebhook>(body, JsonSerializerOptions.Web)
            ?? throw new PaymentWebhookRejectedException("Порожнє повідомлення.");
        return Task.FromResult(new ProviderPaymentStatus(
            message.InvoiceId,
            MapState(message.Status),
            decimal.Parse(message.Amount, CultureInfo.InvariantCulture),
            message.ModifiedDate,
            message.Status == "failure" ? "Тестова відмова банку" : null));
    }

    public async Task<ProviderRefundResult> RefundAsync(string providerPaymentId, string reference, decimal amount, IReadOnlyList<PaymentBasketItem> items, CancellationToken ct)
    {
        var invoice = await db.Set<SandboxInvoice>().FirstOrDefaultAsync(i => i.Id == providerPaymentId, ct);
        if (invoice is null || invoice.Status != "success" && invoice.Status != "reversed")
        {
            return ProviderRefundResult.Failed("Рахунок не оплачено.");
        }

        if (invoice.RefundedAmount + amount > invoice.Amount)
        {
            return ProviderRefundResult.Failed("Сума повернення більша за оплачену.");
        }

        invoice.RefundedAmount += amount;
        invoice.ModifiedAt = time.GetUtcNow();
        if (invoice.RefundedAmount >= invoice.Amount)
        {
            invoice.Status = "reversed";
        }

        await db.SaveChangesAsync(ct);
        return ProviderRefundResult.Succeeded;
    }

    public Task<ProviderRefundResult?> FindRefundAsync(string providerPaymentId, string reference, CancellationToken ct) =>
        throw new NotSupportedException("Тестовий провайдер не зберігає окремих повернень.");

    public async Task<bool> CancelInvoiceAsync(string providerPaymentId, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var closed = await db.Set<SandboxInvoice>()
            .Where(i => i.Id == providerPaymentId && (i.Status == "created" || i.Status == "processing"))
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.Status, "expired").SetProperty(i => i.ModifiedAt, now), ct);
        if (closed == 1)
        {
            return true;
        }

        var status = await db.Set<SandboxInvoice>().Where(i => i.Id == providerPaymentId).Select(i => i.Status).FirstOrDefaultAsync(ct);
        return status is null or "expired" or "failure";
    }

    internal (byte[] Body, string Signature) BuildWebhook(SandboxInvoice invoice)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(
            new SandboxWebhook(invoice.Id, invoice.Status, invoice.Amount.ToString("0.00", CultureInfo.InvariantCulture), invoice.ModifiedAt),
            JsonSerializerOptions.Web);
        return (body, Sign(body));
    }

    private string Sign(byte[] body)
    {
        var secret = options.Value.Sandbox.Secret;
        if (string.IsNullOrEmpty(secret))
        {
            throw new InvalidOperationException("Не задано Payments:Sandbox:Secret.");
        }

        return Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), body));
    }

    private static ProviderPaymentStatus ToStatus(SandboxInvoice invoice) =>
        new(invoice.Id, MapState(invoice.Status), invoice.Amount, invoice.ModifiedAt, invoice.Status == "failure" ? "Тестова відмова банку" : null);

    private static ProviderPaymentState MapState(string status) => status switch
    {
        "success" => ProviderPaymentState.Succeeded,
        "failure" => ProviderPaymentState.Failed,
        "expired" => ProviderPaymentState.Expired,
        "reversed" => ProviderPaymentState.Reversed,
        "processing" => ProviderPaymentState.Processing,
        _ => ProviderPaymentState.Created,
    };
}
