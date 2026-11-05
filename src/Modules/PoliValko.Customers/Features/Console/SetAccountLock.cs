using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Console;

internal static class SetAccountLock
{
    public static async Task<Results<Ok<ConsoleAccountDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        SetAccountLockRequest request,
        PoliValkoDbContext db,
        ICustomerOrderHistory orders,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        if (request.Locked is not { } locked)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["locked"] = ["Вкажіть, заблокувати чи розблокувати кабінет."] });
        }

        var customer = await db.Set<Customer>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null)
        {
            return ConsoleAccountMapping.NotFound();
        }

        var now = time.GetUtcNow();
        if (locked)
        {
            customer.Block(now);
        }
        else
        {
            customer.Unblock();
        }

        audit.Record(locked ? "customer.locked" : "customer.unlocked", "Customer", customer.Id.ToString(), new { customer.Email });
        await db.SaveChangesAsync(ct);
        var counts = await orders.CountOrdersAsync([id], ct);
        return TypedResults.Ok(ConsoleAccountMapping.ToDto(customer, counts.GetValueOrDefault(id), now));
    }
}
