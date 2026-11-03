using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Features.Admin.Orders;

internal static class GetAdminOrder
{
    public static async Task<Results<Ok<AdminOrderDto>, ProblemHttpResult>> HandleAsync(string number, PoliValkoDbContext db, CancellationToken ct)
    {
        var order = await OrderLoader.LoadAsync(db, number, tracking: false, ct);
        return order is null ? AdminOrderMapping.NotFound(number) : TypedResults.Ok(AdminOrderMapping.ToDto(order));
    }
}
