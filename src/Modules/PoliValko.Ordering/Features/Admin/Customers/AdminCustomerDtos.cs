using Microsoft.AspNetCore.Mvc;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Admin.Customers;

public sealed record AdminCustomerDto(
    string Phone,
    string Name,
    string? Email,
    int Orders,
    MoneyDto TotalSpent,
    DateTimeOffset FirstOrderAt,
    DateTimeOffset LastOrderAt,
    string LastOrderNumber);

public sealed record AdminCustomerQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "sort")] string? Sort,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

public static class AdminCustomerSorts
{
    public const string LastOrder = "lastOrder";
    public const string TotalSpent = "totalSpent";
    public const string Orders = "orders";

    public static readonly IReadOnlyList<string> All = [LastOrder, TotalSpent, Orders];
}

public sealed record CustomerContact(string Name, string? Email, string LastOrderNumber);
