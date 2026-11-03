using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace PoliValko.Delivery.Features.Storefront;

internal static class DeliveryEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/delivery").WithTags("Delivery");

        group.MapGet("/np/settlements", SearchSettlements.HandleAsync)
            .WithName("SearchNovaPoshtaSettlements")
            .WithSummary("Населені пункти Нової пошти (від 2 символів; без запиту — популярні)");

        group.MapGet("/np/warehouses", GetWarehouses.HandleAsync)
            .WithName("GetNovaPoshtaWarehouses")
            .WithSummary("Відділення й поштомати в населеному пункті")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/pickup-points", GetPickupPoints.HandleAsync)
            .WithName("GetPickupPoints")
            .WithSummary("Точки самовивозу: адреса, графік роботи, інструкція покупцю");

        return api;
    }
}
