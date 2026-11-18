using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Features.Notifications;

namespace PoliValko.Ordering.Features.Checkout;

internal static class CreateOrder
{
    public static async Task<Results<Created<OrderCreatedDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        CreateOrderRequest request, HttpRequest http, PoliValkoDbContext db, OrderWriter writer, OrderMail mail, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var result = await writer.WriteAsync(request, http, http.Headers[IdempotencyHeaders.Key].ToString(), ct);
        if (result.Result is Created<OrderCreatedDto>)
        {
            await transaction.CommitAsync(ct);
            await mail.SendQueuedAsync();
        }

        return result;
    }
}
