using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Api;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Api;

public sealed record SearchOrderHitDto(string Number, string CustomerName, string Phone, OrderStatus Status, MoneyDto Total, DateTimeOffset CreatedAt);

/// <summary>Назва — для вітрини, якщо задана, інакше з Navkolo.</summary>
public sealed record SearchProductHitDto(Guid Id, string Name, string Sku, string? ImageUrl, MoneyDto Price, bool IsVisible);

/// <summary>Покупець за телефоном; ім'я з останнього замовлення.</summary>
public sealed record SearchCustomerHitDto(string Phone, string Name, int Orders);

/// <summary>Швидкий пошук адмінки: до 5 замовлень, товарів і покупців.</summary>
public sealed record AdminSearchDto(
    IReadOnlyList<SearchOrderHitDto> Orders,
    IReadOnlyList<SearchProductHitDto> Products,
    IReadOnlyList<SearchCustomerHitDto> Customers);

internal static class AdminSearch
{
    private const int MinLength = 2;
    private const int Limit = 5;

    // Пошук іде по замовленнях і каталогу, тому живе в хості API, а не в одному з модулів.
    public static RouteGroupBuilder MapAdminSearch(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/search").WithTags("Admin").RequireStaff()
            .MapGet(string.Empty, SearchAsync)
            .WithName("AdminSearch")
            .WithSummary("Пошук по замовленнях (номер, телефон), товарах (назва, артикул) і покупцях (ім'я, телефон); від 2 символів");
        return admin;
    }

    private static async Task<Ok<AdminSearchDto>> SearchAsync(string? q, PoliValkoDbContext db, CancellationToken ct)
    {
        var term = q?.Trim() ?? string.Empty;
        if (term.Length < MinLength)
        {
            return TypedResults.Ok(new AdminSearchDto([], [], []));
        }

        var orders = await db.Set<Order>().AsNoTracking()
            .MatchingNumberOrPhone(term)
            .OrderByDescending(o => o.CreatedAt)
            .Take(Limit)
            .Select(o => new { o.Number, o.CustomerName, o.CustomerPhone, o.Status, o.Total, o.CreatedAt })
            .ToListAsync(ct);

        var pattern = SqlLike.Contains(term);
        var upper = term.ToUpperInvariant();
        var products = await db.Set<Product>().AsNoTracking()
            .Where(p => EF.Functions.ILike(p.Name, pattern, SqlLike.Escape)
                || (p.DisplayName != null && EF.Functions.ILike(p.DisplayName, pattern, SqlLike.Escape))
                || EF.Functions.ILike(p.Sku, pattern, SqlLike.Escape))
            .OrderBy(p => p.Sku.ToUpper() == upper ? 0 : 1)
            .ThenBy(p => p.DisplayName ?? p.Name)
            .ThenBy(p => p.Id)
            .Take(Limit)
            .Select(p => new
            {
                p.Id,
                Name = p.DisplayName ?? p.Name,
                p.Sku,
                ImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                Price = p.Price.Amount,
                p.IsVisible,
            })
            .ToListAsync(ct);

        var customers = await db.Set<Order>().AsNoTracking()
            .OfCustomersMatching(term)
            .GroupBy(o => o.CustomerPhone)
            .Select(g => new { Phone = g.Key, Orders = g.Count(), LastOrderAt = g.Max(o => o.CreatedAt) })
            .OrderByDescending(c => c.LastOrderAt)
            .ThenBy(c => c.Phone)
            .Take(Limit)
            .ToListAsync(ct);
        var contacts = await AdminCustomerEndpoints.LoadContactsAsync(db, customers.Select(c => c.Phone).ToList(), ct);

        return TypedResults.Ok(new AdminSearchDto(
            orders.Select(o => new SearchOrderHitDto(o.Number, o.CustomerName, o.CustomerPhone, o.Status, MoneyDto.Hryvnia(o.Total), o.CreatedAt)).ToList(),
            products.Select(p => new SearchProductHitDto(p.Id, p.Name, p.Sku, p.ImageUrl, MoneyDto.Hryvnia(p.Price), p.IsVisible)).ToList(),
            customers.Select(c => new SearchCustomerHitDto(c.Phone, contacts[c.Phone].Name, c.Orders)).ToList()));
    }
}
