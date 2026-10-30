using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Api;
using PoliValko.Ordering.Domain;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Providers;
using PoliValko.SharedKernel;

namespace PoliValko.Payments.Api;

public sealed record StartPaymentRequest(string? Token);

public sealed record StartPaymentDto(Guid PaymentId, string PageUrl, DateTimeOffset ExpiresAt);

public sealed record SandboxInvoiceDto(string InvoiceId, string OrderNumber, MoneyDto Amount, string Status, DateTimeOffset ExpiresAt);

public sealed record CompleteSandboxPaymentRequest(string? Outcome, bool? Notify);

public sealed record SandboxCompletionDto(string Status, string RedirectUrl);

public sealed record AdminPaymentDto(
    Guid Id,
    string Provider,
    string? ProviderPaymentId,
    MoneyDto Amount,
    PaymentAttemptStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? FailureReason,
    int EventsCount);

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Payments");

        group.MapPost("/orders/{number}/payments", StartAsync)
            .RequireIdempotency<StartPaymentRequest>()
            .WithName("StartPayment")
            .WithSummary("Відкрити оплату карткою: посилання на сторінку провайдера. Повторно — та сама активна спроба або нова після відмови.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapPost("/payments/webhooks/{provider}", WebhookAsync)
            .WithName("PaymentWebhook")
            .WithSummary("Повідомлення платіжного провайдера. Приймається лише з дійсним підписом; дублікати ігноруються.")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/payments/sandbox/{invoiceId}", GetSandboxInvoiceAsync)
            .WithName("GetSandboxInvoice")
            .WithSummary("Тестова сторінка оплати: дані рахунку (лише Payments:Provider=Sandbox)")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/payments/sandbox/{invoiceId}/complete", CompleteSandboxAsync)
            .WithName("CompleteSandboxPayment")
            .WithSummary("Тестова оплата: успіх, відмова або прострочення. notify=false імітує втрачений вебхук.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }

    public static RouteGroupBuilder MapAdminPaymentEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/orders").WithTags("Admin").RequireStaff()
            .MapGet("/{number}/payments", ListOrderPaymentsAsync)
            .WithName("AdminListOrderPayments")
            .WithSummary("Спроби онлайн-оплати замовлення та отримані повідомлення провайдера");
        return admin;
    }

    private static async Task<Results<Ok<StartPaymentDto>, ProblemHttpResult>> StartAsync(
        string number,
        StartPaymentRequest request,
        PoliValkoDbContext db,
        IPaymentProviders providers,
        IOptions<PaymentsOptions> options,
        IOptions<SiteOptions> site,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken ct)
    {
        var order = await db.Set<Order>().Include(o => o.Items).FirstOrDefaultAsync(o => o.Number == number, ct);
        if (order is null || !CheckoutEndpoints.TokenMatches(order, request.Token))
        {
            return CheckoutEndpoints.OrderNotFound();
        }

        if (!CheckoutEndpoints.CanPay(order))
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "payments.not_payable",
                "Оплата зараз недоступна",
                order.PaymentMethod == PaymentMethod.Card
                    ? "Замовлення ще не підтверджене, уже оплачене або скасоване."
                    : "Для цього замовлення обрано оплату під час отримання.");
        }

        if (providers.Active is not { } provider)
        {
            return Problems.Create(StatusCodes.Status503ServiceUnavailable, "payments.not_configured", "Онлайн-оплата тимчасово недоступна", "Зверніться до менеджера.");
        }

        var now = time.GetUtcNow();

        // Повторне відкриття: якщо попередня спроба ще діє, повертаємо її, а не створюємо другу.
        var active = await db.Set<Payment>()
            .Where(p => p.OrderId == order.Id && p.Provider == provider.Name
                        && (p.Status == PaymentAttemptStatus.Created || p.Status == PaymentAttemptStatus.Processing)
                        && p.ExpiresAt > now && p.PageUrl != null)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (active is not null)
        {
            return TypedResults.Ok(new StartPaymentDto(active.Id, active.PageUrl!, active.ExpiresAt));
        }

        var payment = new Payment
        {
            Id = Guid.CreateVersion7(now),
            OrderId = order.Id,
            OrderNumber = order.Number,
            Provider = provider.Name,
            Amount = order.Total,
            Status = PaymentAttemptStatus.Created,
            CreatedAt = now,
            UpdatedAt = now,
            ExpiresAt = now + options.Value.InvoiceValidity,
        };
        db.Add(payment);
        order.MarkPaymentRetry();
        await db.SaveChangesAsync(ct);

        try
        {
            var invoice = await provider.CreateInvoiceAsync(
                new InvoiceRequest(
                    payment.Id,
                    order.Number,
                    payment.Amount,
                    order.Items.Select(i => new PaymentBasketItem(i.Name, i.Sku, i.Quantity, i.UnitPrice)).ToList(),
                    site.Value.Url($"/order/{order.Number}?token={Uri.EscapeDataString(request.Token!)}&payment=return"),
                    site.Value.Url($"/api/v1/payments/webhooks/{provider.Name}"),
                    payment.ExpiresAt),
                ct);
            payment.ProviderPaymentId = invoice.ProviderPaymentId;
            payment.PageUrl = invoice.PageUrl;
            payment.UpdatedAt = time.GetUtcNow();
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(new StartPaymentDto(payment.Id, invoice.PageUrl, payment.ExpiresAt));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException && !ct.IsCancellationRequested)
        {
            loggers.CreateLogger(typeof(PaymentEndpoints)).LogError(ex, "Оплата: провайдер {Provider} не створив рахунок для {Order}", provider.Name, order.Number);
            payment.Status = PaymentAttemptStatus.Failed;
            payment.FailureReason = "Провайдер недоступний";
            await db.SaveChangesAsync(CancellationToken.None);
            return Problems.Create(StatusCodes.Status503ServiceUnavailable, "payments.provider_unavailable", "Платіжна система недоступна", "Спробуйте ще раз за кілька хвилин.");
        }
    }

    private static async Task<Results<Ok, ProblemHttpResult>> WebhookAsync(
        string provider,
        HttpRequest http,
        IPaymentProviders providers,
        PaymentProcessor processor,
        ILoggerFactory loggers,
        CancellationToken ct)
    {
        if (providers.Find(provider) is not { } handler)
        {
            return Problems.NotFound("payments.unknown_provider", "Невідомий провайдер");
        }

        using var buffer = new MemoryStream();
        await http.Body.CopyToAsync(buffer, ct);
        var body = buffer.ToArray();

        ProviderPaymentStatus status;
        try
        {
            status = await handler.ParseWebhookAsync(body, http.Headers, ct);
        }
        catch (Exception ex) when (ex is PaymentWebhookRejectedException or System.Text.Json.JsonException)
        {
            loggers.CreateLogger(typeof(PaymentEndpoints)).LogWarning("Оплата: відхилено повідомлення {Provider}: {Reason}", provider, ex.Message);
            return Problems.Create(StatusCodes.Status400BadRequest, "payments.webhook_rejected", "Повідомлення не прийнято");
        }

        await processor.ApplyAsync(handler.Name, status, "webhook", Encoding.UTF8.GetString(body), ct);
        return TypedResults.Ok();
    }

    private static async Task<Results<Ok<SandboxInvoiceDto>, ProblemHttpResult>> GetSandboxInvoiceAsync(
        string invoiceId,
        IPaymentProviders providers,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        if (providers.Active?.Name != PaymentProviderNames.Sandbox)
        {
            return Problems.NotFound("http.not_found", "Не знайдено");
        }

        var provider = (SandboxPaymentProvider)providers.Active;
        var status = await db.Set<SandboxInvoice>().AnyAsync(i => i.Id == invoiceId, ct)
            ? await provider.GetStatusAsync(invoiceId, ct)
            : null;
        var invoice = await db.Set<SandboxInvoice>().AsNoTracking().FirstOrDefaultAsync(i => i.Id == invoiceId, ct);
        return invoice is null || status is null
            ? Problems.NotFound("payments.invoice_not_found", "Рахунок не знайдено")
            : TypedResults.Ok(new SandboxInvoiceDto(invoice.Id, invoice.OrderNumber, MoneyDto.Hryvnia(invoice.Amount), invoice.Status, invoice.ExpiresAt));
    }

    private static async Task<Results<Ok<SandboxCompletionDto>, ValidationProblem, ProblemHttpResult>> CompleteSandboxAsync(
        string invoiceId,
        CompleteSandboxPaymentRequest request,
        IPaymentProviders providers,
        PaymentProcessor processor,
        PoliValkoDbContext db,
        TimeProvider time,
        CancellationToken ct)
    {
        if (providers.Active is not SandboxPaymentProvider provider)
        {
            return Problems.NotFound("http.not_found", "Не знайдено");
        }

        var outcome = request.Outcome switch
        {
            "success" => "success",
            "failure" => "failure",
            "expired" => "expired",
            _ => null,
        };
        if (outcome is null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["outcome"] = ["Допустимі значення: success, failure, expired."] });
        }

        var invoice = await db.Set<SandboxInvoice>().FirstOrDefaultAsync(i => i.Id == invoiceId, ct);
        if (invoice is null)
        {
            return Problems.NotFound("payments.invoice_not_found", "Рахунок не знайдено");
        }

        if (invoice.Status is not ("created" or "processing"))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "payments.invoice_closed", "Рахунок уже закрито", $"Стан рахунку: {invoice.Status}.");
        }

        invoice.Status = outcome;
        invoice.ModifiedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);

        // notify=false — «втрачений» вебхук: стан підхопить фонова звірка Worker.
        if (request.Notify != false)
        {
            var (body, signature) = provider.BuildWebhook(invoice);
            var headers = new HeaderDictionary { [SandboxPaymentProvider.SignatureHeader] = signature };
            var status = await provider.ParseWebhookAsync(body, headers, ct);
            await processor.ApplyAsync(provider.Name, status, "sandbox", Encoding.UTF8.GetString(body), ct);
        }

        return TypedResults.Ok(new SandboxCompletionDto(invoice.Status, invoice.RedirectUrl));
    }

    private static async Task<Ok<List<AdminPaymentDto>>> ListOrderPaymentsAsync(string number, PoliValkoDbContext db, CancellationToken ct)
    {
        var payments = await db.Set<Payment>()
            .AsNoTracking()
            .Where(p => p.OrderNumber == number)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new
            {
                Payment = p,
                Events = db.Set<PaymentEvent>().Count(e => e.PaymentId == p.Id),
            })
            .ToListAsync(ct);

        return TypedResults.Ok(payments.Select(x => new AdminPaymentDto(
                x.Payment.Id,
                x.Payment.Provider,
                x.Payment.ProviderPaymentId,
                MoneyDto.Hryvnia(x.Payment.Amount),
                x.Payment.Status,
                x.Payment.CreatedAt,
                x.Payment.UpdatedAt,
                x.Payment.FailureReason,
                x.Events))
            .ToList());
    }
}
