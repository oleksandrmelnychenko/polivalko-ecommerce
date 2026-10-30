using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Api;

/// <summary>
/// Покупець у списку адмінки. Облікових записів покупців немає (гостьове оформлення), тож покупець —
/// це телефон; ім'я й email беруться з останнього замовлення (email — останній непорожній).
/// <see cref="TotalSpent"/> — сума нескасованих замовлень за вирахуванням повернень.
/// </summary>
public sealed record AdminCustomerDto(
    string Phone,
    string Name,
    string? Email,
    int Orders,
    MoneyDto TotalSpent,
    DateTimeOffset FirstOrderAt,
    DateTimeOffset LastOrderAt,
    string LastOrderNumber);

/// <summary>
/// <c>q</c> — частина імені чи email або від трьох цифр телефону;
/// <c>sort</c> — lastOrder (типово), totalSpent, orders; усі за спаданням.
/// </summary>
public sealed record AdminCustomerQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "sort")] string? Sort,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

/// <summary>Порядок списку покупців (параметр <c>sort</c>).</summary>
public static class AdminCustomerSorts
{
    public const string LastOrder = "lastOrder";
    public const string TotalSpent = "totalSpent";
    public const string Orders = "orders";

    public static readonly IReadOnlyList<string> All = [LastOrder, TotalSpent, Orders];
}

/// <summary>Контакти покупця з його замовлень: ім'я й номер з останнього, email — останній непорожній.</summary>
public sealed record CustomerContact(string Name, string? Email, string LastOrderNumber);

public static class AdminCustomerEndpoints
{
    public static RouteGroupBuilder MapAdminCustomerEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/customers").WithTags("Admin").RequireStaff()
            .MapGet(string.Empty, ListAsync)
            .WithName("AdminListCustomers")
            .WithSummary("Покупці, зібрані із замовлень за телефоном: кількість замовлень, сума покупок, перше й останнє");
        return admin;
    }

    private static async Task<Results<Ok<PagedResponse<AdminCustomerDto>>, ValidationProblem>> ListAsync(
        [AsParameters] AdminCustomerQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var sort = AdminCustomerSorts.LastOrder;
        if (!string.IsNullOrWhiteSpace(query.Sort))
        {
            var known = AdminCustomerSorts.All.FirstOrDefault(s => string.Equals(s, query.Sort.Trim(), StringComparison.OrdinalIgnoreCase));
            if (known is null)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["sort"] = [$"Допустимі значення: {string.Join(", ", AdminCustomerSorts.All)}."],
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

                // Виручка: нескасовані замовлення мінус повернення.
                TotalSpent = g.Sum(o => o.Status != OrderStatus.Cancelled ? o.Total - o.RefundedAmount : 0m),
                FirstOrderAt = g.Min(o => o.CreatedAt),
                LastOrderAt = g.Max(o => o.CreatedAt),
            });

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await customers.CountAsync(ct);
        var sorted = sort switch
        {
            AdminCustomerSorts.TotalSpent => customers.OrderByDescending(c => c.TotalSpent).ThenByDescending(c => c.LastOrderAt),
            AdminCustomerSorts.Orders => customers.OrderByDescending(c => c.Orders).ThenByDescending(c => c.LastOrderAt),
            _ => customers.OrderByDescending(c => c.LastOrderAt),
        };
        var rows = await sorted.ThenBy(c => c.Phone).Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);
        var contacts = await LoadContactsAsync(db, rows.Select(r => r.Phone).ToList(), ct);

        var items = rows.Select(r =>
            {
                var contact = contacts[r.Phone];
                return new AdminCustomerDto(
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

        return TypedResults.Ok(PagedResponse<AdminCustomerDto>.Create(items, page, total));
    }

    /// <summary>Контакти для сторінки покупців: один запит на всі телефони сторінки.</summary>
    public static async Task<Dictionary<string, CustomerContact>> LoadContactsAsync(
        PoliValkoDbContext db,
        IReadOnlyCollection<string> phones,
        CancellationToken ct)
    {
        if (phones.Count == 0)
        {
            return [];
        }

        var orders = await db.Set<Order>().AsNoTracking()
            .Where(o => phones.Contains(o.CustomerPhone))
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)
            .Select(o => new { o.CustomerPhone, o.CustomerName, o.CustomerEmail, o.Number })
            .ToListAsync(ct);

        return orders
            .GroupBy(o => o.CustomerPhone)
            .ToDictionary(
                g => g.Key,
                g => new CustomerContact(
                    g.First().CustomerName,
                    g.Select(o => o.CustomerEmail).FirstOrDefault(e => !string.IsNullOrWhiteSpace(e)),
                    g.First().Number));
    }
}
