using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class OrderSearch
{
    /// <summary>
    /// Orders whose number, phone or buyer's name contains the term. The name ignores case («коваль» finds
    /// «Олена Коваль») and needs two letters, so a single one does not list half the orders.
    /// </summary>
    public static IQueryable<Order> MatchingNumberPhoneOrName(this IQueryable<Order> orders, string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return orders;
        }

        var trimmed = q.Trim();
        var term = trimmed.ToUpperInvariant();
        var digits = SqlLike.Digits(term);
        var byName = trimmed.Length >= 2;
        var pattern = SqlLike.Contains(trimmed);
        // Digits alone also find a number typed with spaces, as read out on the phone («4827 1593»).
        return orders.Where(o => o.Number.Contains(term)
            || (digits.Length >= 3 && (o.CustomerPhone.Contains(digits) || o.Number.Contains(digits)))
            || (byName && EF.Functions.ILike(o.CustomerName, pattern, SqlLike.Escape)));
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
