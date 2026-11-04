using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace PoliValko.Console.Features.Audit;

public sealed record AuditEntryDto(Guid Id, DateTimeOffset At, string Actor, string Action, string EntityType, string? EntityId, JsonElement? Details);

public sealed record AuditQuery(
    [FromQuery(Name = "entityType")] string? EntityType,
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);
