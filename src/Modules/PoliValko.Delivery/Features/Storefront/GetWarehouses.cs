using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Delivery.Contracts;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Delivery.Features.Storefront;

internal static class GetWarehouses
{
    public static async Task<Results<Ok<List<WarehouseDto>>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string? settlementRef,
        string? q,
        IDeliveryDirectory directory,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(settlementRef))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["settlementRef"] = ["Оберіть населений пункт."],
            });
        }

        var warehouses = await directory.GetWarehousesAsync(settlementRef, q, ct);
        if (warehouses is null)
        {
            return Problems.NotFound("delivery.settlement_not_found", "Населений пункт не знайдено", "Оберіть населений пункт зі списку.");
        }

        return TypedResults.Ok(warehouses.Select(w => new WarehouseDto(w.Ref, w.Number, w.Name, w.Address, w.Type)).ToList());
    }
}
