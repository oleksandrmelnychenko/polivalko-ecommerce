using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Customers.Features.Addresses;
using PoliValko.SharedKernel;

namespace PoliValko.Customers.Features.Console;

public sealed record ConsoleAccountDto(
    Guid Id,
    string Email,
    string Name,
    string? Phone,
    bool EmailConfirmed,
    bool LockedOut,
    DateTimeOffset CreatedAt,
    int OrdersCount);

public sealed record ConsoleAccountOrderDto(string Number, DateTimeOffset CreatedAt, string Status, MoneyDto Total);

public sealed record ConsoleAccountDetailsDto(
    Guid Id,
    string Email,
    string Name,
    string? Phone,
    bool EmailConfirmed,
    bool LockedOut,
    DateTimeOffset CreatedAt,
    int OrdersCount,
    bool Blocked,
    IReadOnlyList<CustomerAddressDto> Addresses,
    int FavoritesCount,
    IReadOnlyList<ConsoleAccountOrderDto> Orders);

public sealed record SetAccountLockRequest(bool? Locked);

public sealed record ConsoleAccountQuery(
    [property: Description("Email, ім'я або телефон")] [FromQuery(Name = "q")] string? Q,
    [property: Description("all | confirmed | unconfirmed | locked")] [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

public static class ConsoleAccountStatuses
{
    public const string All = "all";
    public const string Confirmed = "confirmed";
    public const string Unconfirmed = "unconfirmed";
    public const string Locked = "locked";

    public static readonly IReadOnlyList<string> Values = [All, Confirmed, Unconfirmed, Locked];
}
