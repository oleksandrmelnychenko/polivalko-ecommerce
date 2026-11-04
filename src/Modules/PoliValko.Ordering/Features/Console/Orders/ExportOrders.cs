using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class ExportOrders
{
    public static async Task<Results<FileContentHttpResult, ValidationProblem>> HandleAsync(
        [AsParameters] ConsoleOrderExportQuery query,
        PoliValkoDbContext db,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var filter = ConsoleOrderFilter.Parse(query.Q, query.Status, query.PaymentStatus, query.Delivery, query.From, query.To, query.Sort, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var rows = await filter.ApplySort(filter.Apply(db.Set<Order>().AsNoTracking()))
            .Take(OrderCsv.MaxRows)
            .Select(o => new OrderCsv.Row(
                o.Number,
                o.CreatedAt,
                o.CustomerName,
                o.CustomerPhone,
                o.CustomerEmail,
                o.Status,
                o.PaymentStatus,
                o.PaymentMethod,
                o.DeliveryMethod,
                o.Items.Count,
                o.Total,
                o.RefundedAmount))
            .ToListAsync(ct);

        return TypedResults.File(
            OrderCsv.Build(rows),
            OrderCsv.ContentType,
            OrderCsv.FileName(KyivTime.Today(time)));
    }
}
