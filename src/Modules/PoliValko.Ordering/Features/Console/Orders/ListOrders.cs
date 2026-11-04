using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class ListOrders
{
    public static async Task<Results<Ok<PagedResponse<ConsoleOrderListItemDto>>, ValidationProblem>> HandleAsync(
        [AsParameters] ConsoleOrderQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var filter = ConsoleOrderFilter.Parse(query.Q, query.Status, query.PaymentStatus, query.Delivery, query.From, query.To, query.Sort, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var orders = filter.Apply(db.Set<Order>().AsNoTracking());
        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await orders.CountAsync(ct);
        var rows = await filter.ApplySort(orders)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .Select(o => new
            {
                o.Number,
                o.CreatedAt,
                o.CustomerName,
                o.CustomerPhone,
                o.Total,
                o.Status,
                o.PaymentStatus,
                o.DeliveryMethod,
                ItemsCount = o.Items.Count,
            })
            .ToListAsync(ct);

        var items = rows.Select(r => new ConsoleOrderListItemDto(
                r.Number,
                r.CreatedAt,
                r.CustomerName,
                r.CustomerPhone,
                MoneyDto.Hryvnia(r.Total),
                r.Status,
                r.PaymentStatus,
                DeliveryCodes.From(r.DeliveryMethod),
                r.ItemsCount))
            .ToList();

        return TypedResults.Ok(PagedResponse<ConsoleOrderListItemDto>.Create(items, page, total));
    }
}
