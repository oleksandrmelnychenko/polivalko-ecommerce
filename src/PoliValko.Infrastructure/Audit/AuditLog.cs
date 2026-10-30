using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Infrastructure.Audit;

/// <summary>
/// Запис журналу змін: доступи, статуси замовлень, повернення коштів, каталог і критичні
/// налаштування (розділ 9 ТЗ). Записи лише додаються.
/// </summary>
public sealed class AuditEntry
{
    public Guid Id { get; init; }

    public DateTimeOffset At { get; init; }

    /// <summary>Ім'я працівника або "Система".</summary>
    public required string Actor { get; init; }

    /// <summary>Машинна назва дії, напр. <c>order.status_changed</c>.</summary>
    public required string Action { get; init; }

    public required string EntityType { get; init; }

    public string? EntityId { get; init; }

    /// <summary>JSON з деталями зміни (старе й нове значення). Без паролів і токенів.</summary>
    public string? Details { get; init; }
}

public interface IAuditLog
{
    /// <summary>Додає запис у поточний контекст; зберігається тим самим SaveChanges, що й зміна.</summary>
    void Record(string action, string entityType, string? entityId, object? details = null);
}

internal sealed class EfAuditLog(PoliValkoDbContext db, IHttpContextAccessor http, TimeProvider time) : IAuditLog
{
    public const string SystemActor = "Система";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public void Record(string action, string entityType, string? entityId, object? details = null)
    {
        var user = http.HttpContext?.User;
        var now = time.GetUtcNow();
        db.Add(new AuditEntry
        {
            Id = Guid.CreateVersion7(now),
            At = now,
            Actor = user?.Identity?.IsAuthenticated == true ? user.StaffName() : SystemActor,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details is null ? null : JsonSerializer.Serialize(details, Json),
        });
    }
}

internal sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("audit_log", Schemas.Integration);
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Actor).HasMaxLength(200);
        builder.Property(e => e.Action).HasMaxLength(100);
        builder.Property(e => e.EntityType).HasMaxLength(100);
        builder.Property(e => e.EntityId).HasMaxLength(200);
        builder.Property(e => e.Details).HasColumnType("jsonb");
        builder.HasIndex(e => e.At);
        builder.HasIndex(e => new { e.EntityType, e.EntityId });
    }
}
