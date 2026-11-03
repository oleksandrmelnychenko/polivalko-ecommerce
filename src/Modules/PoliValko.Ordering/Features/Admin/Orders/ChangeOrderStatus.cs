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

internal static class ChangeOrderStatus
{
    public static async Task<Results<Ok<AdminOrderDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string number,
        ChangeOrderStatusRequest request,
        ClaimsPrincipal user,
        PoliValkoDbContext db,
        IOutbox outbox,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        if (request.Status is not { } target)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Оберіть новий статус."] });
        }

        if (request.Reason is { Length: > 500 })
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["reason"] = ["Не більше 500 символів."] });
        }

        var order = await OrderLoader.LoadAsync(db, number, tracking: true, ct);
        if (order is null)
        {
            return AdminOrderMapping.NotFound(number);
        }

        if (!OrderTransitions.Allowed(order).Contains(target))
        {
            var detail = target == OrderStatus.Cancelled && !OrderTransitions.CanCancel(order)
                ? "Замовлення оплачене онлайн: спочатку оформіть повне повернення коштів."
                : $"Із поточного статусу дозволено: {string.Join(", ", OrderTransitions.Allowed(order))}.";
            return Problems.Create(StatusCodes.Status409Conflict, "ordering.invalid_transition", "Такий перехід статусу недоступний", detail);
        }

        var from = order.Status;
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        order.ChangeStatus(target, time.GetUtcNow(), user.StaffName(), reason);

        if (target == OrderStatus.Completed && order.PaymentMethod != PaymentMethod.Card)
        {
            outbox.Enqueue(new FiscalReceiptRequested(order.Id, FiscalTrigger.Completion));
        }

        audit.Record("order.status_changed", "Order", order.Number, new { from, to = target, reason });
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
