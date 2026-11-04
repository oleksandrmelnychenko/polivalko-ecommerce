using Microsoft.AspNetCore.Mvc;
using PoliValko.Content.Domain;

namespace PoliValko.Content.Features.ServiceRequests.Console;

public sealed record ConsoleServiceRequestDto(
    Guid Id,
    DateTimeOffset CreatedAt,
    string Name,
    string Phone,
    string DirectionCode,
    string DirectionName,
    string? Comment,
    ServiceRequestStatus Status);

public sealed record ChangeServiceRequestStatusRequest(ServiceRequestStatus? Status);

public sealed record ConsoleServiceRequestQuery(
    [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);
