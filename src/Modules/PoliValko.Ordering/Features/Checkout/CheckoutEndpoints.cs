using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Ordering.Features.Checkout;

internal static class CheckoutEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        Features.Cart.CartEndpoints.Map(api);
        var group = api.MapGroup(string.Empty).WithTags("Checkout");

        group.MapPost("/checkout/quote", QuoteCheckout.HandleAsync)
            .WithName("QuoteCheckout")
            .WithSummary("Перерахунок кошика на сервері: ціни, наявність, способи отримання й оплати");

        group.MapPost("/orders", CreateOrder.HandleAsync)
            .RequireIdempotency<CreateOrderRequest>()
            .RequireRateLimiting(RateLimitPolicies.Orders)
            .WithName("CreateOrder")
            .WithSummary("Гостьове замовлення. Сервер повторно перевіряє ціни й наявність.")
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        group.MapGet("/orders/{number}", GetOrder.HandleAsync)
            .WithName("GetOrder")
            .WithSummary("Статус замовлення для покупця (за токеном зі сторінки результату)")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/seller", GetSeller.HandleAsync)
            .WithName("GetSeller")
            .WithSummary("Продавець, з яким покупець укладає договір (для оферти й сторінки замовлення)");

        return api;
    }
}
