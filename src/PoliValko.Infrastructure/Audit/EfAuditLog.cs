using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Infrastructure.Audit;

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
