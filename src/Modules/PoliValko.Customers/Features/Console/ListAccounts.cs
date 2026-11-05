using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Customers.Features.Console;

internal static class ListAccounts
{
    public static async Task<Results<Ok<PagedResponse<ConsoleAccountDto>>, ValidationProblem>> HandleAsync(
        [AsParameters] ConsoleAccountQuery query,
        PoliValkoDbContext db,
        ICustomerOrderHistory orders,
        TimeProvider time,
        CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var status = string.IsNullOrWhiteSpace(query.Status) ? ConsoleAccountStatuses.All : query.Status.Trim().ToLowerInvariant();
        var customers = db.Set<Customer>().AsNoTracking();
        switch (status)
        {
            case ConsoleAccountStatuses.All:
                break;
            case ConsoleAccountStatuses.Confirmed:
                customers = customers.Where(c => c.EmailConfirmedAt != null);
                break;
            case ConsoleAccountStatuses.Unconfirmed:
                customers = customers.Where(c => c.EmailConfirmedAt == null);
                break;
            case ConsoleAccountStatuses.Locked:
                customers = customers.Where(c => c.BlockedAt != null || c.LockoutEnd > now);
                break;
            default:
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["status"] = [$"Допустимі значення: {string.Join(", ", ConsoleAccountStatuses.Values)}."],
                });
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var pattern = SqlLike.Contains(term);
            var digits = SqlLike.Digits(term);
            customers = customers.Where(c => EF.Functions.ILike(c.Email, pattern, SqlLike.Escape)
                || EF.Functions.ILike(c.Name, pattern, SqlLike.Escape)
                || (digits.Length >= 3 && c.Phone != null && c.Phone.Contains(digits)));
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await customers.CountAsync(ct);
        var rows = await customers.OrderByDescending(c => c.CreatedAt).ThenBy(c => c.Id).Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);
        var counts = await orders.CountOrdersAsync(rows.Select(r => r.Id).ToList(), ct);
        var items = rows.Select(c => ConsoleAccountMapping.ToDto(c, counts.GetValueOrDefault(c.Id), now)).ToList();
        return TypedResults.Ok(PagedResponse<ConsoleAccountDto>.Create(items, page, total));
    }
}
