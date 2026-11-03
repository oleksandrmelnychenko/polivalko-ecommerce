using Microsoft.AspNetCore.Mvc;
using PoliValko.Content.Domain;

namespace PoliValko.Content.Features.ServiceRequests.Admin;

public sealed record AdminServiceRequestDto(
    Guid Id,
    DateTimeOffset CreatedAt,
    string Name,
    string Phone,
    string DirectionCode,
    string DirectionName,
    string? Comment,
    ServiceRequestStatus Status);

public sealed record ChangeServiceRequestStatusRequest(ServiceRequestStatus? Status);

public sealed record AdminServiceRequestQuery(
    [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);
