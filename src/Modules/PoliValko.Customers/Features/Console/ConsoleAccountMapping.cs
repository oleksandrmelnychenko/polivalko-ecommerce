using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Customers.Features.Console;

internal static class ConsoleAccountMapping
{
    public static ConsoleAccountDto ToDto(Customer c, int ordersCount, DateTimeOffset now) =>
        new(c.Id, c.Email, c.Name, c.Phone, c.EmailConfirmedAt is not null, c.IsBlockedOrLockedOut(now), c.CreatedAt, ordersCount);

    public static ProblemHttpResult NotFound() =>
        Problems.NotFound("accounts.not_found", "Кабінет покупця не знайдено");
}
