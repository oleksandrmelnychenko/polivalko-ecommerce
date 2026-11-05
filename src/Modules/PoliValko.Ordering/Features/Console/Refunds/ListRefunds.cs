using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Console.Orders;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Refunds;

internal static class ListRefunds
{
    public static async Task<Results<Ok<PagedResponse<ConsoleRefundRowDto>>, ValidationProblem>> HandleAsync(
        [AsParameters] ConsoleRefundQuery query,
        PoliValkoDbContext db,
        IRefundReceiptStatuses receipts,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (!QueryEnum.TryParse<RefundStatus>(query.Status, out var status))
        {
            errors["status"] = [$"Допустимі значення: {QueryEnum.Allowed<RefundStatus>()}."];
        }

        if (query.From is { } start && query.To is { } end && start > end)
        {
            errors["from"] = ["Дата «з» не може бути пізнішою за дату «по»."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var refunds = db.Set<OrderRefund>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var orderIds = db.Set<Order>().MatchingNumberOrPhone(query.Q).Select(o => o.Id);
            refunds = refunds.Where(r => orderIds.Contains(r.OrderId));
        }

        if (status is { } wanted)
        {
            refunds = refunds.Where(r => r.Status == wanted);
        }

        if (query.From is { } from)
        {
            var since = KyivTime.StartOfDay(from);
            refunds = refunds.Where(r => r.CreatedAt >= since);
        }

        if (query.To is { } to)
        {
            var until = KyivTime.StartOfDay(to.AddDays(1));
            refunds = refunds.Where(r => r.CreatedAt < until);
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await refunds.CountAsync(ct);
        var rows = await refunds
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .Join(db.Set<Order>(), r => r.OrderId, o => o.Id, (r, o) => new
            {
                r.Id,
                o.Number,
                r.CreatedAt,
                r.Amount,
                r.Method,
                r.Status,
                r.Reason,
                r.RequestedBy,
            })
            .ToListAsync(ct);
        var receiptStatuses = await receipts.GetAsync(rows.Select(r => r.Id).ToList(), ct);
        var items = rows
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
            .Select(r => new ConsoleRefundRowDto(
                r.Id,
                r.Number,
                r.CreatedAt,
                MoneyDto.Hryvnia(r.Amount),
                r.Method == RefundMethod.Provider ? RefundChannel.Card : RefundChannel.Offline,
                r.Status,
                r.Reason,
                r.RequestedBy,
                receiptStatuses.GetValueOrDefault(r.Id)))
            .ToList();
        return TypedResults.Ok(PagedResponse<ConsoleRefundRowDto>.Create(items, page, total));
    }
}
