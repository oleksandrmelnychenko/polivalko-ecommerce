namespace PoliValko.Ordering.Domain;

public enum OrderStatus
{
    New,

    /// <summary>Ціна чи наявність потребують підтвердження менеджера (дані ERP застарілі).</summary>
    AwaitingConfirmation,
    Confirmed,
    AwaitingPayment,
    Paid,
    Shipped,
    ReadyForPickup,
    Completed,
    Cancelled,
}

public enum PaymentMethod
{
    Card,
    CashOnDelivery,
    PayOnPickup,
}

/// <summary>Авторитетний статус платежу зберігає бекенд; менеджер його не змінює (розділ 9 ТЗ).</summary>
public enum PaymentStatus
{
    NotRequired,
    Pending,
    Succeeded,
    Failed,
    PartiallyRefunded,
    Refunded,
}

public enum DeliveryMethod
{
    NovaPoshta,
    Pickup,
    NovaPoshtaCourier,
}

public sealed class Order
{
    public Guid Id { get; init; }

    /// <summary>Людиночитний номер, напр. PV-100001.</summary>
    public required string Number { get; init; }

    public required string AccessTokenHash { get; init; }

    public required string IdempotencyKey { get; init; }

    public OrderStatus Status { get; set; }

    public PaymentMethod PaymentMethod { get; init; }

    public PaymentStatus PaymentStatus { get; private set; }

    public DeliveryMethod DeliveryMethod { get; init; }

    public required string CustomerName { get; init; }

    /// <summary>E.164 (+380XXXXXXXXX).</summary>
    public required string CustomerPhone { get; init; }

    public string? CustomerEmail { get; init; }

    public string? SettlementRef { get; init; }

    public string? SettlementName { get; init; }

    public string? WarehouseRef { get; init; }

    public string? WarehouseName { get; init; }

    /// <summary>Адреса кур'єрської доставки: вулиця, будинок, квартира.</summary>
    public string? DeliveryAddress { get; init; }

    /// <summary>Знімок адреси самовивозу на момент замовлення.</summary>
    public string? PickupAddress { get; init; }

    public string? Comment { get; init; }

    /// <summary>Продавець замовлення (розділ 5 ТЗ): платіж, чек і повернення відповідають йому.</summary>
    public required string SellerName { get; init; }

    public string? SellerTaxId { get; init; }

    public decimal Subtotal { get; init; }

    public decimal Total { get; init; }

    /// <summary>Сума успішних повернень коштів.</summary>
    public decimal RefundedAmount { get; private set; }

    /// <summary>Номер замовлення в Navkolo після передачі через чергу.</summary>
    public string? NavkoloOrderRef { get; private set; }

    public DateTimeOffset? NavkoloExportedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>xmin PostgreSQL для оптимістичної конкуренції.</summary>
    public uint Version { get; private set; }

    public List<OrderItem> Items { get; init; } = [];

    public List<OrderStatusChange> History { get; init; } = [];

    public List<OrderRefund> Refunds { get; init; } = [];

    public void InitPaymentStatus() =>
        PaymentStatus = PaymentMethod == PaymentMethod.Card ? PaymentStatus.Pending : PaymentStatus.NotRequired;

    public void ChangeStatus(OrderStatus to, DateTimeOffset at, string by, string? reason = null)
    {
        History.Add(new OrderStatusChange
        {
            Id = Guid.CreateVersion7(at),
            OrderId = Id,
            From = Status,
            To = to,
            At = at,
            By = by,
            Reason = reason,
        });
        Status = to;
    }

    /// <summary>Перевірене повідомлення провайдера про успішну оплату. Повторне нічого не змінює.</summary>
    public bool MarkPaid(DateTimeOffset at, string by)
    {
        if (PaymentStatus is PaymentStatus.Succeeded or PaymentStatus.PartiallyRefunded or PaymentStatus.Refunded)
        {
            return false;
        }

        PaymentStatus = PaymentStatus.Succeeded;
        if (Status == OrderStatus.AwaitingPayment)
        {
            ChangeStatus(OrderStatus.Paid, at, by);
        }

        return true;
    }

    /// <summary>Відмова, переривання або прострочення спроби оплати. Успішну оплату не скасовує.</summary>
    public void MarkPaymentFailed()
    {
        if (PaymentStatus == PaymentStatus.Pending)
        {
            PaymentStatus = PaymentStatus.Failed;
        }
    }

    /// <summary>Нова спроба після невдалої (повторне відкриття оплати).</summary>
    public void MarkPaymentRetry()
    {
        if (PaymentStatus == PaymentStatus.Failed)
        {
            PaymentStatus = PaymentStatus.Pending;
        }
    }

    public void ApplySucceededRefund(OrderRefund refund, DateTimeOffset at)
    {
        if (refund.Status == RefundStatus.Succeeded)
        {
            return;
        }

        refund.Status = RefundStatus.Succeeded;
        refund.CompletedAt = at;
        refund.Error = null;
        RefundedAmount += refund.Amount;
        if (PaymentMethod == PaymentMethod.Card)
        {
            PaymentStatus = RefundedAmount >= Total ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;
        }
    }

    public void MarkExported(string reference, DateTimeOffset at)
    {
        NavkoloOrderRef ??= reference;
        NavkoloExportedAt ??= at;
    }
}

/// <summary>Позиція зберігає знімок товару й ціни на момент покупки.</summary>
public sealed class OrderItem
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public Guid ProductId { get; init; }

    public required string Sku { get; init; }

    public required string Name { get; init; }

    public required string Slug { get; init; }

    public string? ImageUrl { get; init; }

    public decimal UnitPrice { get; init; }

    public int Quantity { get; init; }

    public decimal LineTotal { get; init; }
}

public sealed class OrderStatusChange
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    /// <summary>null — замовлення щойно створене.</summary>
    public OrderStatus? From { get; init; }

    public OrderStatus To { get; init; }

    public DateTimeOffset At { get; init; }

    /// <summary>"Покупець", "Платіжна система" або ім'я працівника.</summary>
    public required string By { get; init; }

    public string? Reason { get; init; }
}

public enum RefundMethod
{
    /// <summary>Повернення на картку через платіжного провайдера.</summary>
    Provider,

    /// <summary>Готівкою чи переказом поза сайтом (післяплата, оплата в магазині); сайт фіксує факт і чек.</summary>
    Manual,
}

public enum RefundStatus
{
    Pending,
    Succeeded,
    Failed,
}

/// <summary>Повне або часткове повернення за позиціями (розділ 6 ТЗ). Сума рахується з цін у замовленні.</summary>
public sealed class OrderRefund
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public RefundMethod Method { get; init; }

    public RefundStatus Status { get; set; }

    public decimal Amount { get; init; }

    public required string Reason { get; init; }

    public required string RequestedBy { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>Ідентифікатор операції повернення в платіжного провайдера.</summary>
    public string? ProviderRef { get; set; }

    public string? Error { get; set; }

    public List<OrderRefundLine> Lines { get; init; } = [];
}

public sealed class OrderRefundLine
{
    public Guid Id { get; init; }

    public Guid RefundId { get; init; }

    public Guid OrderItemId { get; init; }

    public int Quantity { get; init; }

    public decimal Amount { get; init; }
}
