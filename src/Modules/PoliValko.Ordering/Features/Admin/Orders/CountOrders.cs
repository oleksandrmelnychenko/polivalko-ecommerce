using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Admin.Orders;

internal static class CountOrders
{
    public static async Task<Results<Ok<AdminOrderCountsDto>, ValidationProblem>> HandleAsync(
        [AsParameters] AdminOrderCountsQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var filter = AdminOrderFilter.Parse(query.Q, null, query.PaymentStatus, query.Delivery, query.From, query.To, null, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var counts = await filter.Apply(db.Set<Order>().AsNoTracking(), byStatus: false)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return TypedResults.Ok(new AdminOrderCountsDto(counts.Sum(c => c.Count), OrderStatusCounts.From(counts.Select(c => (c.Status, c.Count)))));
    }
}
