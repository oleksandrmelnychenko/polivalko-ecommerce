using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Api;

public sealed record AdminOrderListItemDto(
    string Number,
    DateTimeOffset CreatedAt,
    string CustomerName,
    string Phone,
    MoneyDto Total,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    string DeliveryMethod,
    int ItemsCount);

public sealed record AdminOrderHistoryDto(OrderStatus? From, OrderStatus To, DateTimeOffset At, string By, string? Reason);

public sealed record AdminRefundLineDto(Guid ProductId, string Sku, string Name, int Quantity, MoneyDto Amount);

public sealed record AdminRefundDto(
    Guid Id,
    DateTimeOffset CreatedAt,
    RefundMethod Method,
    RefundStatus Status,
    MoneyDto Amount,
    string Reason,
    string RequestedBy,
    DateTimeOffset? CompletedAt,
    string? Error,
    IReadOnlyList<AdminRefundLineDto> Lines);

/// <summary>Скільки одиниць позиції ще можна повернути.</summary>
public sealed record RefundableItemDto(Guid ProductId, int Quantity);

public sealed record AdminOrderDto(
    string Number,
    DateTimeOffset CreatedAt,
    OrderStatus Status,
    string PaymentMethod,
    PaymentStatus PaymentStatus,
    string DeliveryMethod,
    string? SettlementName,
    string? WarehouseName,
    string? PickupAddress,
    string CustomerName,
    string Phone,
    string? Email,
    string? Comment,
    IReadOnlyList<OrderItemDto> Items,
    MoneyDto Subtotal,
    MoneyDto Total,
    IReadOnlyList<AdminOrderHistoryDto> History,
    IReadOnlyList<OrderStatus> AllowedTransitions,
    string? DeliveryAddress,
    string SellerName,
    string? SellerTaxId,
    string? NavkoloOrderRef,
    DateTimeOffset? NavkoloExportedAt,
    MoneyDto RefundedAmount,
    IReadOnlyList<AdminRefundDto> Refunds,
    RefundMethod? RefundMethod,
    IReadOnlyList<RefundableItemDto> Refundable);

public sealed record ChangeOrderStatusRequest(OrderStatus? Status, string? Reason);

public sealed record RefundLineRequest(Guid ProductId, int Quantity);

public sealed record CreateRefundRequest(IReadOnlyList<RefundLineRequest>? Lines, string? Reason);

/// <summary>
/// Список замовлень. <c>delivery</c> — код способу отримання (nova_poshta, nova_poshta_courier, pickup);
/// <c>from</c>/<c>to</c> — дати за Києвом включно; <c>sort</c> — newest (типово), oldest, totalDesc, totalAsc.
/// </summary>
public sealed record AdminOrderQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "paymentStatus")] string? PaymentStatus,
    [FromQuery(Name = "delivery")] string? Delivery,
    [FromQuery(Name = "from")] DateOnly? From,
    [FromQuery(Name = "to")] DateOnly? To,
    [FromQuery(Name = "sort")] string? Sort,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

/// <summary>Ті самі фільтри, що й у списку, без статусу, порядку й сторінок: лічильники для вкладок статусів.</summary>
public sealed record AdminOrderCountsQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "paymentStatus")] string? PaymentStatus,
    [FromQuery(Name = "delivery")] string? Delivery,
    [FromQuery(Name = "from")] DateOnly? From,
    [FromQuery(Name = "to")] DateOnly? To);

/// <summary>Ті самі фільтри й порядок, що й у списку, без сторінок (до 5000 рядків).</summary>
public sealed record AdminOrderExportQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "paymentStatus")] string? PaymentStatus,
    [FromQuery(Name = "delivery")] string? Delivery,
    [FromQuery(Name = "from")] DateOnly? From,
    [FromQuery(Name = "to")] DateOnly? To,
    [FromQuery(Name = "sort")] string? Sort);

/// <summary>Кількість замовлень зі статусом. Нульові статуси не повертаються.</summary>
public sealed record OrderStatusCountDto(OrderStatus Status, int Count);

/// <summary>Лічильники для вкладок статусів: усі замовлення за фільтрами й розбивка за статусами в порядку перелічення.</summary>
public sealed record AdminOrderCountsDto(int All, IReadOnlyList<OrderStatusCountDto> ByStatus);

public static class AdminOrderEndpoints
{
    public static RouteGroupBuilder MapAdminOrderEndpoints(this RouteGroupBuilder admin)
    {
        var group = admin.MapGroup("/orders").WithTags("Admin").RequireStaff();

        group.MapGet(string.Empty, ListAsync)
            .WithName("AdminListOrders")
            .WithEnumQuery<OrderStatus>("status")
            .WithEnumQuery<PaymentStatus>("paymentStatus")
            .WithSummary("Замовлення: пошук за номером або телефоном, фільтри за статусом, оплатою, способом отримання й датами");

        // Літеральні сегменти маршруту мають пріоритет над /{number}, тож номер замовлення їх не перекриває.
        group.MapGet("/counts", CountsAsync)
            .WithName("AdminOrderCounts")
            .WithEnumQuery<PaymentStatus>("paymentStatus")
            .WithSummary("Кількість замовлень за статусами з тими самими фільтрами, що й у списку");

        group.MapGet("/export", ExportAsync)
            .WithName("AdminExportOrders")
            .WithEnumQuery<OrderStatus>("status")
            .WithEnumQuery<PaymentStatus>("paymentStatus")
            .Produces<string>(StatusCodes.Status200OK, "text/csv")
            .WithSummary("Вивантаження замовлень у CSV для Excel (UTF-8 з BOM, роздільник «;», до 5000 рядків)");

        group.MapGet("/{number}", GetAsync)
            .WithName("AdminGetOrder")
            .WithSummary("Картка замовлення з історією обробки, поверненнями й передачею в Navkolo")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/{number}/status", ChangeStatusAsync)
            .WithName("AdminChangeOrderStatus")
            .WithSummary("Зміна статусу за таблицею переходів. Статус оплати тут не змінюється.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/{number}/refunds", CreateRefundAsync)
            .RequireIdempotency<CreateRefundRequest>()
            .WithName("AdminCreateRefund")
            .WithSummary("Повне або часткове повернення за позиціями: на картку через провайдера або фіксація готівкового повернення")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return admin;
    }

    private static async Task<Results<Ok<PagedResponse<AdminOrderListItemDto>>, ValidationProblem>> ListAsync(
        [AsParameters] AdminOrderQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var filter = AdminOrderFilter.Parse(query.Q, query.Status, query.PaymentStatus, query.Delivery, query.From, query.To, query.Sort, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var orders = filter.Apply(db.Set<Order>().AsNoTracking());
        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await orders.CountAsync(ct);
        var rows = await filter.ApplySort(orders)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .Select(o => new
            {
                o.Number,
                o.CreatedAt,
                o.CustomerName,
                o.CustomerPhone,
                o.Total,
                o.Status,
                o.PaymentStatus,
                o.DeliveryMethod,
                ItemsCount = o.Items.Count,
            })
            .ToListAsync(ct);

        var items = rows.Select(r => new AdminOrderListItemDto(
                r.Number,
                r.CreatedAt,
                r.CustomerName,
                r.CustomerPhone,
                MoneyDto.Hryvnia(r.Total),
                r.Status,
                r.PaymentStatus,
                DeliveryCodes.From(r.DeliveryMethod),
                r.ItemsCount))
            .ToList();

        return TypedResults.Ok(PagedResponse<AdminOrderListItemDto>.Create(items, page, total));
    }

    private static async Task<Results<Ok<AdminOrderCountsDto>, ValidationProblem>> CountsAsync(
        [AsParameters] AdminOrderCountsQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var filter = AdminOrderFilter.Parse(query.Q, null, query.PaymentStatus, query.Delivery, query.From, query.To, null, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var counts = await filter.Apply(db.Set<Order>().AsNoTracking(), byStatus: false)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return TypedResults.Ok(new AdminOrderCountsDto(counts.Sum(c => c.Count), ToStatusCounts(counts.Select(c => (c.Status, c.Count)))));
    }

    private static async Task<Results<FileContentHttpResult, ValidationProblem>> ExportAsync(
        [AsParameters] AdminOrderExportQuery query,
        PoliValkoDbContext db,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var filter = AdminOrderFilter.Parse(query.Q, query.Status, query.PaymentStatus, query.Delivery, query.From, query.To, query.Sort, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var rows = await filter.ApplySort(filter.Apply(db.Set<Order>().AsNoTracking()))
            .Take(AdminOrderExport.MaxRows)
            .Select(o => new AdminOrderExport.Row(
                o.Number,
                o.CreatedAt,
                o.CustomerName,
                o.CustomerPhone,
                o.CustomerEmail,
                o.Status,
                o.PaymentStatus,
                o.PaymentMethod,
                o.DeliveryMethod,
                o.Items.Count,
                o.Total,
                o.RefundedAmount))
            .ToListAsync(ct);

        return TypedResults.File(
            AdminOrderExport.Build(rows),
            AdminOrderExport.ContentType,
            AdminOrderExport.FileName(KyivTime.Today(time)));
    }

    /// <summary>Лише ненульові статуси в порядку перелічення (як ідуть етапи обробки).</summary>
    public static IReadOnlyList<OrderStatusCountDto> ToStatusCounts(IEnumerable<(OrderStatus Status, int Count)> counts) =>
        counts.Where(c => c.Count > 0)
            .OrderBy(c => c.Status)
            .Select(c => new OrderStatusCountDto(c.Status, c.Count))
            .ToList();

    private static async Task<Results<Ok<AdminOrderDto>, ProblemHttpResult>> GetAsync(string number, PoliValkoDbContext db, CancellationToken ct)
    {
        var order = await CheckoutEndpoints.LoadAsync(db, number, tracking: false, ct);
        return order is null ? NotFound(number) : TypedResults.Ok(ToDto(order));
    }

    private static async Task<Results<Ok<AdminOrderDto>, ValidationProblem, ProblemHttpResult>> ChangeStatusAsync(
        string number,
        ChangeOrderStatusRequest request,
        ClaimsPrincipal user,
        PoliValkoDbContext db,
        IOutbox outbox,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        if (request.Status is not { } target)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Оберіть новий статус."] });
        }

        if (request.Reason is { Length: > 500 })
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["reason"] = ["Не більше 500 символів."] });
        }

        var order = await CheckoutEndpoints.LoadAsync(db, number, tracking: true, ct);
        if (order is null)
        {
            return NotFound(number);
        }

        if (!OrderTransitions.Allowed(order).Contains(target))
        {
            var detail = target == OrderStatus.Cancelled && !OrderTransitions.CanCancel(order)
                ? "Замовлення оплачене онлайн: спочатку оформіть повне повернення коштів."
                : $"Із поточного статусу дозволено: {string.Join(", ", OrderTransitions.Allowed(order))}.";
            return Problems.Create(StatusCodes.Status409Conflict, "ordering.invalid_transition", "Такий перехід статусу недоступний", detail);
        }

        var from = order.Status;
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        order.ChangeStatus(target, time.GetUtcNow(), user.StaffName(), reason);

        // Оплата під час отримання підтверджується виконанням замовлення: тоді за правилами може знадобитися чек.
        if (target == OrderStatus.Completed && order.PaymentMethod != PaymentMethod.Card)
        {
            outbox.Enqueue(new FiscalReceiptRequested(order.Id, FiscalTrigger.Completion));
        }

        audit.Record("order.status_changed", "Order", order.Number, new { from, to = target, reason });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "ordering.concurrent_update", "Замовлення щойно змінилося", "Оновіть картку замовлення.");
        }

        return TypedResults.Ok(ToDto(order));
    }

    private static async Task<Results<Ok<AdminOrderDto>, ValidationProblem, ProblemHttpResult>> CreateRefundAsync(
        string number,
        CreateRefundRequest request,
        ClaimsPrincipal user,
        PoliValkoDbContext db,
        IOutbox outbox,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var order = await CheckoutEndpoints.LoadAsync(db, number, tracking: true, ct);
        if (order is null)
        {
            return NotFound(number);
        }

        if (RefundMethodFor(order) is not { } method)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "ordering.refund_not_available",
                "Повернення недоступне",
                "Повернути можна оплачене онлайн замовлення або виконане замовлення з оплатою під час отримання.");
        }

        var errors = new Dictionary<string, string[]>();
        var reason = request.Reason?.Trim();
        if (string.IsNullOrEmpty(reason) || reason.Length > 500)
        {
            errors["reason"] = ["Вкажіть причину повернення (до 500 символів)."];
        }

        var refundable = Refundable(order).ToDictionary(r => r.ProductId, r => r.Quantity);
        var lines = (request.Lines ?? []).Where(l => l.Quantity != 0).ToList();
        if (lines.Count == 0)
        {
            errors["lines"] = ["Оберіть товари й кількість для повернення."];
        }
        else if (lines.Select(l => l.ProductId).Distinct().Count() != lines.Count
                 || lines.Any(l => l.Quantity < 0 || !refundable.TryGetValue(l.ProductId, out var max) || l.Quantity > max))
        {
            errors["lines"] = ["Кількість для повернення не може перевищувати куплену й ще не повернуту."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var now = time.GetUtcNow();
        var refundId = Guid.CreateVersion7(now);
        var refundLines = lines.Select(l =>
        {
            var item = order.Items.Single(i => i.ProductId == l.ProductId);
            return new OrderRefundLine { Id = Guid.CreateVersion7(now), RefundId = refundId, OrderItemId = item.Id, Quantity = l.Quantity, Amount = item.UnitPrice * l.Quantity };
        }).ToList();
        var refund = new OrderRefund
        {
            Id = refundId,
            OrderId = order.Id,
            Method = method,
            Status = RefundStatus.Pending,
            Amount = refundLines.Sum(l => l.Amount),
            Reason = reason!,
            RequestedBy = user.StaffName(),
            CreatedAt = now,
            Lines = refundLines,
        };
        order.Refunds.Add(refund);

        if (method == RefundMethod.Provider)
        {
            // Гроші повертає провайдер; результат прийде через фоновий обробник модуля платежів.
            outbox.Enqueue(new RefundRequested(order.Id, refund.Id));
        }
        else
        {
            order.ApplySucceededRefund(refund, now);
            outbox.Enqueue(new FiscalReceiptRequested(order.Id, FiscalTrigger.Refund, refund.Id));
        }

        audit.Record("order.refund_created", "Order", order.Number, new { refund.Id, method, amount = refund.Amount, reason, lines = lines.Count });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "ordering.concurrent_update", "Замовлення щойно змінилося", "Оновіть картку замовлення.");
        }

        return TypedResults.Ok(ToDto(order));
    }

    /// <summary>Спосіб повернення для замовлення або null, якщо повертати нічого.</summary>
    internal static RefundMethod? RefundMethodFor(Order order) => order switch
    {
        { PaymentMethod: PaymentMethod.Card, PaymentStatus: PaymentStatus.Succeeded or PaymentStatus.PartiallyRefunded } => RefundMethod.Provider,
        { PaymentMethod: not PaymentMethod.Card, Status: OrderStatus.Completed } => RefundMethod.Manual,
        _ => null,
    };

    /// <summary>Куплена кількість мінус повернення, що не завершилися невдачею.</summary>
    private static IEnumerable<RefundableItemDto> Refundable(Order order)
    {
        var returned = order.Refunds
            .Where(r => r.Status != RefundStatus.Failed)
            .SelectMany(r => r.Lines)
            .GroupBy(l => l.OrderItemId)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.Quantity));
        return order.Items
            .Select(i => new RefundableItemDto(i.ProductId, i.Quantity - returned.GetValueOrDefault(i.Id)))
            .Where(r => r.Quantity > 0);
    }

    private static AdminOrderDto ToDto(Order order)
    {
        var items = order.Items.ToDictionary(i => i.Id);
        var method = RefundMethodFor(order);
        return new AdminOrderDto(
            order.Number,
            order.CreatedAt,
            order.Status,
            PaymentCodes.From(order.PaymentMethod),
            order.PaymentStatus,
            DeliveryCodes.From(order.DeliveryMethod),
            order.SettlementName,
            order.WarehouseName,
            order.PickupAddress,
            order.CustomerName,
            order.CustomerPhone,
            order.CustomerEmail,
            order.Comment,
            order.Items.Select(CheckoutEndpoints.ToDto).ToList(),
            MoneyDto.Hryvnia(order.Subtotal),
            MoneyDto.Hryvnia(order.Total),
            order.History.OrderBy(h => h.At).Select(h => new AdminOrderHistoryDto(h.From, h.To, h.At, h.By, h.Reason)).ToList(),
            OrderTransitions.Allowed(order),
            order.DeliveryAddress,
            order.SellerName,
            order.SellerTaxId,
            order.NavkoloOrderRef,
            order.NavkoloExportedAt,
            MoneyDto.Hryvnia(order.RefundedAmount),
            order.Refunds.OrderBy(r => r.CreatedAt).Select(r => new AdminRefundDto(
                r.Id,
                r.CreatedAt,
                r.Method,
                r.Status,
                MoneyDto.Hryvnia(r.Amount),
                r.Reason,
                r.RequestedBy,
                r.CompletedAt,
                r.Error,
                r.Lines.Select(l => new AdminRefundLineDto(
                    items[l.OrderItemId].ProductId,
                    items[l.OrderItemId].Sku,
                    items[l.OrderItemId].Name,
                    l.Quantity,
                    MoneyDto.Hryvnia(l.Amount))).ToList())).ToList(),
            method,
            method is null ? [] : Refundable(order).ToList());
    }

    private static ProblemHttpResult NotFound(string number) =>
        Problems.NotFound("ordering.order_not_found", "Замовлення не знайдено", $"Замовлення {number} не існує.");
}
