using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Fiscal;

public enum ReceiptKind
{
    Sell,
    Return,
}

public enum ReceiptStatus
{
    Pending,
    Issued,
    Failed,
}

/// <summary>Фіскальний чек ПРРО за замовленням (розділ 6 ТЗ). Один чек продажу й по одному на кожне повернення.</summary>
public sealed class Receipt
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public required string OrderNumber { get; init; }

    public ReceiptKind Kind { get; init; }

    public Guid? RefundId { get; init; }

    public decimal Amount { get; init; }

    /// <summary><c>CASHLESS</c> або <c>CASH</c>.</summary>
    public required string PaymentType { get; init; }

    public ReceiptStatus Status { get; set; }

    public required string Provider { get; init; }

    public string? ProviderReceiptId { get; set; }

    public string? FiscalCode { get; set; }

    public string? Url { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? IssuedAt { get; set; }

    public string? Error { get; set; }
}

/// <summary>Коли видається чек продажу для кожного способу оплати (погоджує бухгалтер, розділ 12 ТЗ).</summary>
public enum ReceiptMoment
{
    /// <summary>Чек не видає сайт (напр., у магазині працює власна каса).</summary>
    None,

    /// <summary>Після підтвердженої онлайн-оплати.</summary>
    Payment,

    /// <summary>Після виконання замовлення (оплата під час отримання).</summary>
    Completion,
}

public sealed class FiscalOptions
{
    /// <summary><c>Disabled</c>, <c>Stub</c> або <c>Checkbox</c>.</summary>
    public string Provider { get; set; } = "Disabled";

    public Dictionary<PaymentMethod, ReceiptMoment> IssueOn { get; set; } = new()
    {
        [PaymentMethod.Card] = ReceiptMoment.Payment,
        [PaymentMethod.CashOnDelivery] = ReceiptMoment.Completion,
        [PaymentMethod.PayOnPickup] = ReceiptMoment.None,
    };

    public Dictionary<PaymentMethod, string> PaymentTypes { get; set; } = new()
    {
        [PaymentMethod.Card] = "CASHLESS",
        [PaymentMethod.CashOnDelivery] = "CASHLESS",
        [PaymentMethod.PayOnPickup] = "CASH",
    };

    public CheckboxOptions Checkbox { get; set; } = new();
}

public sealed class CheckboxOptions
{
    public string BaseUrl { get; set; } = "https://api.checkbox.ua";

    /// <summary>Ключ ліцензії каси. Секрет.</summary>
    public string? LicenseKey { get; set; }

    public string? CashierLogin { get; set; }

    /// <summary>Секрет.</summary>
    public string? CashierPassword { get; set; }
}

internal sealed class FiscalModelConfigurator : IModelConfigurator
{
    public void Configure(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<Receipt>(builder =>
        {
            builder.ToTable("receipts", Schemas.Fiscal);
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).ValueGeneratedNever();
            builder.Property(r => r.OrderNumber).HasMaxLength(20);
            builder.Property(r => r.Kind).HasConversion<string>().HasMaxLength(10);
            builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(10);
            builder.Property(r => r.Amount).HasPrecision(12, 2);
            builder.Property(r => r.PaymentType).HasMaxLength(20);
            builder.Property(r => r.Provider).HasMaxLength(30);
            builder.Property(r => r.ProviderReceiptId).HasMaxLength(100);
            builder.Property(r => r.FiscalCode).HasMaxLength(100);
            builder.Property(r => r.Url).HasMaxLength(500);
            builder.Property(r => r.Error).HasMaxLength(1000);
            builder.HasIndex(r => new { r.OrderId, r.Kind, r.RefundId }).IsUnique().AreNullsDistinct(false);
        });
}
