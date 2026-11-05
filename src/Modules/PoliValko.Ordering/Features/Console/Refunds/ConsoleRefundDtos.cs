using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Refunds;

public sealed record ConsoleRefundRowDto(
    Guid Id,
    string OrderNumber,
    DateTimeOffset CreatedAt,
    MoneyDto Amount,
    RefundChannel Method,
    RefundStatus Status,
    string Reason,
    string CreatedBy,
    [property: Description("Стан чека повернення: pending | issued | failed; порожньо, якщо чека немає")] string? ReceiptStatus);

public sealed record ConsoleRefundQuery(
    [property: Description("Номер замовлення або телефон покупця")] [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "from")] DateOnly? From,
    [FromQuery(Name = "to")] DateOnly? To,
    [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);
