using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.Ordering.Features.Cart;

internal static class CartEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/cart").WithTags("Cart").RequireCsrf().RequireRateLimiting(RateLimitPolicies.Cart);
        group.MapPost("/open", OpenAsync).WithName("OpenCart");
        group.MapPut("/", SaveAsync).WithName("SaveCart");
        group.MapPost("/checkout", CheckoutAsync).RequireRateLimiting(RateLimitPolicies.Orders).WithName("CheckoutCart");
    }

    private static async Task<Ok<ServerCartDto>> OpenAsync(HttpContext http, PoliValkoDbContext db, ServerCartStore store, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-store";
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var cart = await store.OpenAsync(http, ct);
        await db.SaveChangesAsync(ct);
        var dto = await store.DtoAsync(cart, ct);
        await tx.CommitAsync(ct);
        return TypedResults.Ok(dto);
    }

    private static async Task<Results<Ok<ServerCartDto>, ValidationProblem, ProblemHttpResult>> SaveAsync(
        SaveCartRequest request, HttpContext http, PoliValkoDbContext db, ServerCartStore store, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-store";
        var errors = new Dictionary<string, string[]>();
        if (request.Items is not { Count: 0 }) CheckoutCalculator.ValidateItems(request.Items, errors);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var owner = store.Owner(http);
        await store.LockAsync(owner, ct);
        var cart = await store.LoadAsync(owner, ct);
        if (cart.Id != request.CartId || cart.Revision != request.Revision) return Changed();
        store.Replace(cart, request.Items!);
        await db.SaveChangesAsync(ct);
        var dto = await store.DtoAsync(cart, ct);
        await tx.CommitAsync(ct);
        return TypedResults.Ok(dto);
    }

    private static async Task<Results<Created<OrderCreatedDto>, ValidationProblem, ProblemHttpResult>> CheckoutAsync(
        CartCheckoutRequest request, HttpContext http, PoliValkoDbContext db, ServerCartStore store, OrderWriter writer, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-store";
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var owner = store.Owner(http);
        await store.LockAsync(owner, ct);
        var cart = await store.LoadAsync(owner, ct);
        if (cart.Id != request.CartId) return Changed();
        // Persisted atomically with the order: retries remain safe after reload, cache expiry, or a lost response.
        if (cart.CheckoutRevision == request.Revision && store.LastOrder(cart) is { } previous)
        {
            http.Response.Headers["Idempotent-Replayed"] = "true";
            return TypedResults.Created($"/api/v1/orders/{previous.Number}", previous);
        }
        if (cart.Revision != request.Revision || request.Order?.Items is null || request.Order.Items.Any(i => i is null) ||
            !ServerCartStore.Items(cart).OrderBy(i => i.ProductId).SequenceEqual(request.Order.Items.OrderBy(i => i.ProductId))) return Changed();
        var result = await writer.WriteAsync(request.Order, http.Request, $"cart:{cart.Id}:{cart.Revision}", ct);
        if (result.Result is Created<OrderCreatedDto> { Value: { } created })
        {
            store.Complete(cart, created);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        return result;
    }

    private static ProblemHttpResult Changed() => Problems.Create(409, "cart.changed", "Кошик змінився",
        "Оновіть кошик і перевірте його перед підтвердженням.");
}
