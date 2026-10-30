using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Ordering;
using PoliValko.Ordering.Api;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Fiscal;

public sealed record ReceiptDto(
    Guid Id,
    ReceiptKind Kind,
    ReceiptStatus Status,
    MoneyDto Amount,
    string PaymentType,
    string Provider,
    string? FiscalCode,
    string? Url,
    DateTimeOffset CreatedAt,
    DateTimeOffset? IssuedAt,
    string? Error);

public static class FiscalModule
{
    public static IServiceCollection AddFiscalModule(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Fiscal");
        services.Configure<FiscalOptions>(section);
        var provider = section.GetValue<string>("Provider");

        if (string.Equals(provider, "Checkbox", StringComparison.OrdinalIgnoreCase))
        {
            services.AddHttpClient<CheckboxFiscalProvider>(client => client.Timeout = TimeSpan.FromSeconds(30));
            services.AddScoped<IFiscalProvider>(sp => sp.GetRequiredService<CheckboxFiscalProvider>());
        }
        else if (string.Equals(provider, "Stub", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IFiscalProvider, StubFiscalProvider>();
        }

        return services
            .AddModelConfigurator<FiscalModelConfigurator>()
            .AddOutboxHandler<FiscalReceiptRequested, IssueReceiptOnRequest>();
    }

    public static IEndpointRouteBuilder MapFiscalEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/orders/{number}/receipts", async Task<Results<Ok<List<ReceiptDto>>, ProblemHttpResult>> (string number, string? token, PoliValkoDbContext db, CancellationToken ct) =>
            {
                var order = await db.Set<Order>().AsNoTracking().FirstOrDefaultAsync(o => o.Number == number, ct);
                if (order is null || !CheckoutEndpoints.TokenMatches(order, token))
                {
                    return CheckoutEndpoints.OrderNotFound();
                }

                return TypedResults.Ok(await ListAsync(db, number, issuedOnly: true, ct));
            })
            .WithTags("Checkout")
            .WithName("GetOrderReceipts")
            .WithSummary("Фіскальні чеки замовлення для покупця (за токеном)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        return api;
    }

    public static RouteGroupBuilder MapAdminFiscalEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/orders").WithTags("Admin").RequireStaff()
            .MapGet("/{number}/receipts", async (string number, PoliValkoDbContext db, CancellationToken ct) =>
                TypedResults.Ok(await ListAsync(db, number, issuedOnly: false, ct)))
            .WithName("AdminListOrderReceipts")
            .WithSummary("Фіскальні чеки продажу й повернення за замовленням");
        return admin;
    }

    private static async Task<List<ReceiptDto>> ListAsync(PoliValkoDbContext db, string number, bool issuedOnly, CancellationToken ct)
    {
        var receipts = db.Set<Receipt>().AsNoTracking().Where(r => r.OrderNumber == number);
        if (issuedOnly)
        {
            receipts = receipts.Where(r => r.Status == ReceiptStatus.Issued);
        }

        var rows = await receipts.OrderBy(r => r.CreatedAt).ToListAsync(ct);
        return rows.Select(r => new ReceiptDto(
                r.Id, r.Kind, r.Status, MoneyDto.Hryvnia(r.Amount), r.PaymentType, r.Provider, r.FiscalCode, r.Url, r.CreatedAt, r.IssuedAt, r.Error))
            .ToList();
    }
}

/// <summary>
/// Видає чек за погодженою матрицею: для кожного способу оплати — момент продажу; чек повернення
/// лише тоді, коли сайт видавав чек продажу. Повтор того самого запиту не створює другого чека.
/// </summary>
internal sealed class IssueReceiptOnRequest(
    PoliValkoDbContext db,
    IOptions<FiscalOptions> options,
    IServiceProvider services,
    TimeProvider time,
    ILogger<IssueReceiptOnRequest> logger) : IOutboxHandler<FiscalReceiptRequested>
{
    public async Task HandleAsync(FiscalReceiptRequested message, CancellationToken cancellationToken)
    {
        if (services.GetService<IFiscalProvider>() is not { } provider)
        {
            logger.LogInformation("Фіскалізацію вимкнено: чек для замовлення {OrderId} не видається", message.OrderId);
            return;
        }

        var order = await db.Set<Order>()
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery()
            .SingleAsync(o => o.Id == message.OrderId, cancellationToken);
        var settings = options.Value;
        var moment = settings.IssueOn.GetValueOrDefault(order.PaymentMethod, ReceiptMoment.None);
        var kind = message.Trigger == FiscalTrigger.Refund ? ReceiptKind.Return : ReceiptKind.Sell;

        var applies = message.Trigger switch
        {
            FiscalTrigger.Payment => moment == ReceiptMoment.Payment,
            FiscalTrigger.Completion => moment == ReceiptMoment.Completion,
            _ => await db.Set<Receipt>().AnyAsync(r => r.OrderId == order.Id && r.Kind == ReceiptKind.Sell && r.Status != ReceiptStatus.Failed, cancellationToken),
        };
        if (!applies)
        {
            return;
        }

        var receipt = await db.Set<Receipt>()
            .FirstOrDefaultAsync(r => r.OrderId == order.Id && r.Kind == kind && r.RefundId == message.RefundId, cancellationToken);
        if (receipt?.Status == ReceiptStatus.Issued)
        {
            return;
        }

        var goods = Goods(order, message.RefundId);
        if (receipt is null)
        {
            receipt = new Receipt
            {
                Id = Guid.CreateVersion7(time.GetUtcNow()),
                OrderId = order.Id,
                OrderNumber = order.Number,
                Kind = kind,
                RefundId = message.RefundId,
                Amount = goods.Sum(g => g.UnitPrice * g.Quantity),
                PaymentType = settings.PaymentTypes.GetValueOrDefault(order.PaymentMethod, "CASHLESS"),
                Status = ReceiptStatus.Pending,
                Provider = provider.Name,
                CreatedAt = time.GetUtcNow(),
            };
            db.Add(receipt);
            await db.SaveChangesAsync(cancellationToken);
        }

        try
        {
            var issued = await provider.IssueAsync(
                new ReceiptDraft(receipt.Id, order.Number, kind == ReceiptKind.Return, goods, receipt.PaymentType, receipt.Amount),
                cancellationToken);
            receipt.Status = ReceiptStatus.Issued;
            receipt.ProviderReceiptId = issued.ProviderReceiptId;
            receipt.FiscalCode = issued.FiscalCode;
            receipt.Url = issued.Url;
            receipt.IssuedAt = time.GetUtcNow();
            receipt.Error = null;
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            // Помилку видно в адмінці; outbox повторить спробу з тим самим ідентифікатором чека.
            receipt.Error = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
            await db.SaveChangesAsync(CancellationToken.None);
            throw;
        }
    }

    private static List<ReceiptGood> Goods(Order order, Guid? refundId)
    {
        if (refundId is null)
        {
            return order.Items.Select(i => new ReceiptGood(i.Sku, i.Name, i.UnitPrice, i.Quantity)).ToList();
        }

        var items = order.Items.ToDictionary(i => i.Id);
        return order.Refunds.Single(r => r.Id == refundId).Lines
            .Select(l => new ReceiptGood(items[l.OrderItemId].Sku, items[l.OrderItemId].Name, items[l.OrderItemId].UnitPrice, l.Quantity))
            .ToList();
    }
}
