using Microsoft.AspNetCore.Http;

namespace PoliValko.Payments.Providers;

public sealed class PaymentsOptions
{
    /// <summary><c>Sandbox</c> (тестова оплата) або <c>Mono</c>. Порожньо — онлайн-оплата недоступна.</summary>
    public string? Provider { get; set; }

    /// <summary>Скільки діє посилання на оплату.</summary>
    public TimeSpan InvoiceValidity { get; set; } = TimeSpan.FromHours(1);

    public SandboxOptions Sandbox { get; set; } = new();

    public MonoOptions Mono { get; set; } = new();
}

public sealed class SandboxOptions
{
    /// <summary>Секрет HMAC для підпису тестових повідомлень.</summary>
    public string? Secret { get; set; }
}

public sealed class MonoOptions
{
    public string BaseUrl { get; set; } = "https://api.monobank.ua";

    /// <summary>X-Token мерчанта. Секрет.</summary>
    public string? Token { get; set; }
}

public sealed record PaymentBasketItem(string Name, string Code, int Quantity, decimal UnitPrice);

public sealed record InvoiceRequest(
    Guid PaymentId,
    string OrderNumber,
    decimal Amount,
    IReadOnlyList<PaymentBasketItem> Basket,
    string RedirectUrl,
    string WebhookUrl,
    DateTimeOffset ExpiresAt);

public sealed record CreatedInvoice(string ProviderPaymentId, string PageUrl);

public enum ProviderPaymentState
{
    Created,
    Processing,
    Succeeded,
    Failed,
    Expired,
    Reversed,
}

/// <summary>Стан платежу в провайдера: з перевіреного вебхука або із запиту статусу.</summary>
public sealed record ProviderPaymentStatus(
    string ProviderPaymentId,
    ProviderPaymentState State,
    decimal? Amount,
    DateTimeOffset? ModifiedAt,
    string? FailureReason)
{
    /// <summary>Ключ дедуплікації: той самий стан того самого платежу на той самий момент.</summary>
    public string EventKey => $"{ProviderPaymentId}:{State}:{ModifiedAt?.ToUnixTimeMilliseconds()}";
}

public sealed record ProviderRefundResult(bool Accepted, string? ProviderRef, string? Error);

/// <summary>Підпис або формат повідомлення не пройшли перевірку.</summary>
public sealed class PaymentWebhookRejectedException(string message) : Exception(message);

/// <summary>Провайдер онлайн-оплати карткою. Один погоджений на старті (розділ 6 ТЗ).</summary>
public interface IPaymentProvider
{
    string Name { get; }

    Task<CreatedInvoice> CreateInvoiceAsync(InvoiceRequest request, CancellationToken ct);

    Task<ProviderPaymentStatus> GetStatusAsync(string providerPaymentId, CancellationToken ct);

    /// <summary>Перевіряє підпис і розбирає повідомлення. Невірний підпис — <see cref="PaymentWebhookRejectedException"/>.</summary>
    Task<ProviderPaymentStatus> ParseWebhookAsync(byte[] body, IHeaderDictionary headers, CancellationToken ct);

    /// <summary>Повне чи часткове повернення. <paramref name="refundId"/> — ідемпотентний ключ операції.</summary>
    Task<ProviderRefundResult> RefundAsync(string providerPaymentId, Guid refundId, decimal amount, IReadOnlyList<PaymentBasketItem> items, CancellationToken ct);
}

public static class PaymentProviderNames
{
    public const string Sandbox = "sandbox";
    public const string Mono = "mono";
}

/// <summary>Активний провайдер за налаштуванням <c>Payments:Provider</c>.</summary>
public interface IPaymentProviders
{
    IPaymentProvider? Active { get; }

    IPaymentProvider? Find(string name);
}

internal sealed class PaymentProviders(IEnumerable<IPaymentProvider> providers, Microsoft.Extensions.Options.IOptions<PaymentsOptions> options) : IPaymentProviders
{
    public IPaymentProvider? Active => Find(options.Value.Provider ?? string.Empty);

    public IPaymentProvider? Find(string name) =>
        providers.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
}
