using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Sync;

/// <summary>
/// Стан фонового завдання (синхронізація Navkolo, довідник Нової пошти): час останньої успішної
/// синхронізації й остання помилка видно в адмінці (розділ 7 ТЗ).
/// </summary>
public sealed class SyncState
{
    /// <summary>Стабільна назва завдання, напр. <c>navkolo.price-stock</c>.</summary>
    public required string Job { get; init; }

    public DateTimeOffset? LastAttemptAt { get; set; }

    public DateTimeOffset? LastSuccessAt { get; set; }

    public string? LastError { get; set; }

    public int ConsecutiveFailures { get; set; }

    /// <summary>Працівник попросив запустити завдання поза розкладом.</summary>
    public DateTimeOffset? RunRequestedAt { get; set; }

    /// <summary>Коли відповідальному надіслано повідомлення про збій; скидається після успіху.</summary>
    public DateTimeOffset? AlertedAt { get; set; }
}

public enum SyncRunStatus
{
    Running,
    Succeeded,

    /// <summary>Завдання виконано, але частину записів пропущено з помилками.</summary>
    PartiallySucceeded,
    Failed,
}

/// <summary>Один запуск завдання з підсумком і звітом помилок (імпорт каталогу, оновлення цін).</summary>
public sealed class SyncRun
{
    public Guid Id { get; init; }

    public required string Job { get; init; }

    public DateTimeOffset StartedAt { get; init; }

    public DateTimeOffset? FinishedAt { get; set; }

    public SyncRunStatus Status { get; set; }

    /// <summary>"Розклад" або ім'я працівника.</summary>
    public required string StartedBy { get; init; }

    public string? Summary { get; set; }

    public int ErrorCount { get; set; }

    /// <summary>JSON-масив <see cref="SyncError"/>, не більше <see cref="SyncJournal.MaxStoredErrors"/>.</summary>
    public string? Errors { get; set; }
}

public sealed record SyncError(string? Item, string Message);

/// <summary>Підсумок запуску. Непорожній <see cref="Errors"/> означає частковий успіх.</summary>
public sealed record SyncResult(string Summary, IReadOnlyList<SyncError> Errors)
{
    public static SyncResult Ok(string summary) => new(summary, []);
}

internal sealed class SyncStateConfiguration : IEntityTypeConfiguration<SyncState>
{
    public void Configure(EntityTypeBuilder<SyncState> builder)
    {
        builder.ToTable("sync_states", Schemas.Integration);
        builder.HasKey(s => s.Job);
        builder.Property(s => s.Job).HasMaxLength(100);
        builder.Property(s => s.LastError).HasMaxLength(2000);
    }
}

internal sealed class SyncRunConfiguration : IEntityTypeConfiguration<SyncRun>
{
    public void Configure(EntityTypeBuilder<SyncRun> builder)
    {
        builder.ToTable("sync_runs", Schemas.Integration);
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Job).HasMaxLength(100);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(30);
        builder.Property(r => r.StartedBy).HasMaxLength(200);
        builder.Property(r => r.Summary).HasMaxLength(1000);
        builder.Property(r => r.Errors).HasColumnType("jsonb");
        builder.HasIndex(r => new { r.Job, r.StartedAt });
    }
}
