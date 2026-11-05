using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class UpdateOrderNote
{
    public const int MaxLength = 1000;

    public static async Task<Results<Ok<ConsoleOrderDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string number,
        UpdateOrderNoteRequest request,
        ClaimsPrincipal user,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > MaxLength })
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["note"] = [$"Не більше {MaxLength} символів."] });
        }

        var order = await OrderLoader.LoadAsync(db, number, tracking: true, ct);
        if (order is null)
        {
            return ConsoleOrderMapping.NotFound(number);
        }

        var before = order.InternalNote;
        if (!order.ChangeInternalNote(note, time.GetUtcNow(), user.StaffName()))
        {
            return TypedResults.Ok(ConsoleOrderMapping.ToDto(order));
        }

        audit.Record("order.note_changed", "Order", order.Number, new { before, after = note });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "ordering.concurrent_update", "Замовлення щойно змінилося", "Оновіть картку замовлення.");
        }

        return TypedResults.Ok(ConsoleOrderMapping.ToDto(order));
    }
}
