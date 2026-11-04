using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Console.Orders;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Customers;

internal static class ListCustomers
{
    public static async Task<Results<Ok<PagedResponse<ConsoleCustomerDto>>, ValidationProblem>> HandleAsync(
        [AsParameters] ConsoleCustomerQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var sort = ConsoleCustomerSorts.LastOrder;
        if (!string.IsNullOrWhiteSpace(query.Sort))
        {
            var known = ConsoleCustomerSorts.All.FirstOrDefault(s => string.Equals(s, query.Sort.Trim(), StringComparison.OrdinalIgnoreCase));
            if (known is null)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["sort"] = [$"Допустимі значення: {string.Join(", ", ConsoleCustomerSorts.All)}."],
                });
            }

            sort = known;
        }

        var customers = db.Set<Order>().AsNoTracking()
            .OfCustomersMatching(query.Q)
            .GroupBy(o => o.CustomerPhone)
            .Select(g => new
            {
                Phone = g.Key,
                Orders = g.Count(),

                TotalSpent = g.Sum(o => o.Status != OrderStatus.Cancelled ? o.Total - o.RefundedAmount : 0m),
                FirstOrderAt = g.Min(o => o.CreatedAt),
                LastOrderAt = g.Max(o => o.CreatedAt),
            });

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await customers.CountAsync(ct);
        var sorted = sort switch
        {
            ConsoleCustomerSorts.TotalSpent => customers.OrderByDescending(c => c.TotalSpent).ThenByDescending(c => c.LastOrderAt),
            ConsoleCustomerSorts.Orders => customers.OrderByDescending(c => c.Orders).ThenByDescending(c => c.LastOrderAt),
            _ => customers.OrderByDescending(c => c.LastOrderAt),
        };
        var rows = await sorted.ThenBy(c => c.Phone).Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);
        var contacts = await CustomerContacts.LoadContactsAsync(db, rows.Select(r => r.Phone).ToList(), ct);

        var items = rows.Select(r =>
            {
                var contact = contacts[r.Phone];
                return new ConsoleCustomerDto(
                    r.Phone,
                    contact.Name,
                    contact.Email,
                    r.Orders,
                    MoneyDto.Hryvnia(r.TotalSpent),
                    r.FirstOrderAt,
                    r.LastOrderAt,
                    contact.LastOrderNumber);
            })
            .ToList();

        return TypedResults.Ok(PagedResponse<ConsoleCustomerDto>.Create(items, page, total));
    }
}
