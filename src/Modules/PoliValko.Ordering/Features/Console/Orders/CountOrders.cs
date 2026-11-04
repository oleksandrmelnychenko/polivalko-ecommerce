using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class CountOrders
{
    public static async Task<Results<Ok<ConsoleOrderCountsDto>, ValidationProblem>> HandleAsync(
        [AsParameters] ConsoleOrderCountsQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var filter = ConsoleOrderFilter.Parse(query.Q, null, query.PaymentStatus, query.Delivery, query.From, query.To, null, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var counts = await filter.Apply(db.Set<Order>().AsNoTracking(), byStatus: false)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return TypedResults.Ok(new ConsoleOrderCountsDto(counts.Sum(c => c.Count), OrderStatusCounts.From(counts.Select(c => (c.Status, c.Count)))));
    }
}
