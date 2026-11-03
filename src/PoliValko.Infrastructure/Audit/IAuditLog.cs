namespace PoliValko.Infrastructure.Audit;

public interface IAuditLog
{
    void Record(string action, string entityType, string? entityId, object? details = null);
}
