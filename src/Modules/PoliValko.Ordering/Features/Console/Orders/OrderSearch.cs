using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class OrderSearch
{
    public static IQueryable<Order> MatchingNumberOrPhone(this IQueryable<Order> orders, string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return orders;
        }

        var term = q.Trim().ToUpperInvariant();
        var digits = SqlLike.Digits(term);
        return orders.Where(o => o.Number.Contains(term) || (digits.Length >= 3 && o.CustomerPhone.Contains(digits)));
    }

    public static IQueryable<Order> OfCustomersMatching(this IQueryable<Order> orders, string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return orders;
        }

        var term = q.Trim();
        var pattern = SqlLike.Contains(term);
        var digits = SqlLike.Digits(term);
        var phones = orders
            .Where(o => EF.Functions.ILike(o.CustomerName, pattern, SqlLike.Escape)
                || (o.CustomerEmail != null && EF.Functions.ILike(o.CustomerEmail, pattern, SqlLike.Escape))
                || (digits.Length >= 3 && o.CustomerPhone.Contains(digits)))
            .Select(o => o.CustomerPhone);
        return orders.Where(o => phones.Contains(o.CustomerPhone));
    }
}
