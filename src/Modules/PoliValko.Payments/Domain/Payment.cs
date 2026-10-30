using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Payments.Domain;

public enum PaymentAttemptStatus
{
    Created,
    Processing,
    Succeeded,
    Failed,
    Expired,

    /// <summary>Провайдер повністю повернув кошти (сторно).</summary>
    Reversed,
}

/// <summary>
/// Спроба онлайн-оплати замовлення. Для одного замовлення їх може бути кілька: після відмови
/// чи переривання покупець відкриває оплату повторно (розділ 6 ТЗ).
/// </summary>
public sealed class Payment
{
    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public required string OrderNumber { get; init; }

    /// <summary>Назва провайдера: <c>sandbox</c>, <c>mono</c>.</summary>
    public required string Provider { get; init; }

    /// <summary>Ідентифікатор рахунку в провайдера (invoiceId).</summary>
    public string? ProviderPaymentId { get; set; }

    public decimal Amount { get; init; }

    public PaymentAttemptStatus Status { get; set; }

    public string? PageUrl { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; init; }

    /// <summary>Час останньої зміни в провайдера: старіші повідомлення ігноруються.</summary>
    public DateTimeOffset? ProviderModifiedAt { get; set; }

    public string? FailureReason { get; set; }

    public bool IsActive => Status is PaymentAttemptStatus.Created or PaymentAttemptStatus.Processing;
}

/// <summary>Отримане повідомлення провайдера. Унікальний ключ відсікає дублікати (розділ 6 ТЗ).</summary>
public sealed class PaymentEvent
{
    public Guid Id { get; init; }

    public required string Provider { get; init; }

    public required string EventKey { get; init; }

    public Guid? PaymentId { get; init; }

    /// <summary><c>webhook</c>, <c>reconcile</c> або <c>sandbox</c>.</summary>
    public required string Source { get; init; }

    public required string State { get; init; }

    public DateTimeOffset ReceivedAt { get; init; }

    public string? Payload { get; init; }
}

/// <summary>Рахунок тестового провайдера: імітує стан на боці платіжної системи.</summary>
public sealed class SandboxInvoice
{
    public required string Id { get; init; }

    public required string OrderNumber { get; init; }

    public decimal Amount { get; init; }

    public decimal RefundedAmount { get; set; }

    public required string Status { get; set; }

    public required string RedirectUrl { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ModifiedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; init; }
}

internal sealed class PaymentsModelConfigurator : IModelConfigurator
{
    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Payment>(builder =>
        {
            builder.ToTable("payments", Schemas.Payments);
            builder.HasKey(p => p.Id);
            builder.Property(p => p.Id).ValueGeneratedNever();
            builder.Property(p => p.OrderNumber).HasMaxLength(20);
            builder.Property(p => p.Provider).HasMaxLength(30);
            builder.Property(p => p.ProviderPaymentId).HasMaxLength(200);
            builder.Property(p => p.Amount).HasPrecision(12, 2);
            builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
            builder.Property(p => p.PageUrl).HasMaxLength(1000);
            builder.Property(p => p.FailureReason).HasMaxLength(500);
            builder.Ignore(p => p.IsActive);
            builder.HasIndex(p => p.OrderId);
            builder.HasIndex(p => new { p.Provider, p.ProviderPaymentId }).IsUnique();
            builder.HasIndex(p => new { p.Status, p.CreatedAt });
        });

        modelBuilder.Entity<PaymentEvent>(builder =>
        {
            builder.ToTable("payment_events", Schemas.Payments);
            builder.HasKey(e => e.Id);
            builder.Property(e => e.Id).ValueGeneratedNever();
            builder.Property(e => e.Provider).HasMaxLength(30);
            builder.Property(e => e.EventKey).HasMaxLength(300);
            builder.Property(e => e.Source).HasMaxLength(20);
            builder.Property(e => e.State).HasMaxLength(30);
            builder.Property(e => e.Payload).HasColumnType("jsonb");
            builder.HasIndex(e => new { e.Provider, e.EventKey }).IsUnique();
            builder.HasIndex(e => e.PaymentId);
        });

        modelBuilder.Entity<SandboxInvoice>(builder =>
        {
            builder.ToTable("sandbox_invoices", Schemas.Payments);
            builder.HasKey(i => i.Id);
            builder.Property(i => i.Id).HasMaxLength(100);
            builder.Property(i => i.OrderNumber).HasMaxLength(20);
            builder.Property(i => i.Amount).HasPrecision(12, 2);
            builder.Property(i => i.RefundedAmount).HasPrecision(12, 2);
            builder.Property(i => i.Status).HasMaxLength(20);
            builder.Property(i => i.RedirectUrl).HasMaxLength(1000);
        });
    }
}
