using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Fiscal.Configuration;
using PoliValko.Fiscal.Domain;
using PoliValko.Fiscal.Integrations.Providers;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Features.Issuing;

internal sealed class IssueReceiptOnRequest(
    PoliValkoDbContext db,
    IOrderReceiptSource orders,
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

        var order = await orders.GetAsync(message.OrderId, cancellationToken);
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
            receipt.Error = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
            await db.SaveChangesAsync(CancellationToken.None);
            throw;
        }
    }

    private static List<ReceiptGood> Goods(OrderForReceipt order, Guid? refundId)
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
