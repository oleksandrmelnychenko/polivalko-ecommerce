using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.ServiceRequests;

internal static class ServiceRequestEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Services");

        group.MapGet("/service-directions", GetServiceDirections.HandleAsync)
            .WithName("GetServiceDirections")
            .WithSummary("Напрямки послуг");

        group.MapPost("/service-requests", SubmitServiceRequest.HandleAsync)
            .RequireIdempotency<CreateServiceRequest>()
            .RequireRateLimiting(RateLimitPolicies.Forms)
            .WithName("CreateServiceRequest")
            .WithSummary("Заявка на послугу. Зберігається в адмінці, відповідальний отримує повідомлення.")
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        return api;
    }
}
