using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Addresses;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Customers.Features.Console;

internal static class GetAccount
{
    public const int OrdersShown = 50;

    public static async Task<Results<Ok<ConsoleAccountDetailsDto>, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        ICustomerOrderHistory orders,
        ICustomerFavoritesCounter favorites,
        TimeProvider time,
        CancellationToken ct)
    {
        var customer = await db.Set<Customer>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null)
        {
            return ConsoleAccountMapping.NotFound();
        }

        var addresses = await db.Set<CustomerAddress>()
            .AsNoTracking()
            .Where(a => a.CustomerId == id)
            .OrderByDescending(a => a.IsDefault)
            .ThenBy(a => a.CreatedAt)
            .ToListAsync(ct);
        var counts = await orders.CountOrdersAsync([id], ct);
        var recent = await orders.ListOrdersAsync(id, OrdersShown, ct);
        var row = ConsoleAccountMapping.ToDto(customer, counts.GetValueOrDefault(id), time.GetUtcNow());
        return TypedResults.Ok(new ConsoleAccountDetailsDto(
            row.Id,
            row.Email,
            row.Name,
            row.Phone,
            row.EmailConfirmed,
            row.LockedOut,
            row.CreatedAt,
            row.OrdersCount,
            customer.BlockedAt is not null,
            addresses.Select(AddressMapping.ToDto).ToList(),
            await favorites.CountFavoritesAsync(id, ct),
            recent.Select(o => new ConsoleAccountOrderDto(o.Number, o.CreatedAt, o.Status, MoneyDto.Hryvnia(o.Total))).ToList()));
    }
}
