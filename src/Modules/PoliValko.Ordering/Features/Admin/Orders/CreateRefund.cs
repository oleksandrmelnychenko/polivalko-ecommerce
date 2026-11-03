using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Features.Admin.Orders;

internal static class CreateRefund
{
    public static async Task<Results<Ok<AdminOrderDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string number,
        CreateRefundRequest request,
        ClaimsPrincipal user,
        PoliValkoDbContext db,
        IOutbox outbox,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var order = await OrderLoader.LoadAsync(db, number, tracking: true, ct);
        if (order is null)
        {
            return AdminOrderMapping.NotFound(number);
        }

        if (AdminOrderMapping.RefundMethodFor(order) is not { } method)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "ordering.refund_not_available",
                "Повернення недоступне",
                "Повернути можна оплачене онлайн замовлення або виконане замовлення з оплатою під час отримання.");
        }

        var errors = new Dictionary<string, string[]>();
        var reason = request.Reason?.Trim();
        if (string.IsNullOrEmpty(reason) || reason.Length > 500)
        {
            errors["reason"] = ["Вкажіть причину повернення (до 500 символів)."];
        }

        var refundable = AdminOrderMapping.Refundable(order).ToDictionary(r => r.ProductId, r => r.Quantity);
        var lines = (request.Lines ?? []).Where(l => l.Quantity != 0).ToList();
        if (lines.Count == 0)
        {
            errors["lines"] = ["Оберіть товари й кількість для повернення."];
        }
        else if (lines.Select(l => l.ProductId).Distinct().Count() != lines.Count
                 || lines.Any(l => l.Quantity < 0 || !refundable.TryGetValue(l.ProductId, out var max) || l.Quantity > max))
        {
            errors["lines"] = ["Кількість для повернення не може перевищувати куплену й ще не повернуту."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var now = time.GetUtcNow();
        var refundId = Guid.CreateVersion7(now);
        var refundLines = lines.Select(l =>
        {
            var item = order.Items.Single(i => i.ProductId == l.ProductId);
            return new OrderRefundLine { Id = Guid.CreateVersion7(now), RefundId = refundId, OrderItemId = item.Id, Quantity = l.Quantity, Amount = item.UnitPrice * l.Quantity };
        }).ToList();
        var refund = new OrderRefund
        {
            Id = refundId,
            OrderId = order.Id,
            Method = method,
            Status = RefundStatus.Pending,
            Amount = refundLines.Sum(l => l.Amount),
            Reason = reason!,
            RequestedBy = user.StaffName(),
            CreatedAt = now,
            Lines = refundLines,
        };
        order.Refunds.Add(refund);

        if (method == RefundMethod.Provider)
        {
            outbox.Enqueue(new RefundRequested(order.Id, refund.Id));
        }
        else
        {
            order.ApplySucceededRefund(refund, now);
            outbox.Enqueue(new FiscalReceiptRequested(order.Id, FiscalTrigger.Refund, refund.Id));
        }

        audit.Record("order.refund_created", "Order", order.Number, new { refund.Id, method, amount = refund.Amount, reason, lines = lines.Count });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "ordering.concurrent_update", "Замовлення щойно змінилося", "Оновіть картку замовлення.");
        }

        return TypedResults.Ok(AdminOrderMapping.ToDto(order));
    }
}
