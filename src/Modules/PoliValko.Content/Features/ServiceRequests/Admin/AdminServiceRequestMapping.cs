using PoliValko.Content.Domain;

namespace PoliValko.Content.Features.ServiceRequests.Admin;

internal static class AdminServiceRequestMapping
{
    public static AdminServiceRequestDto ToDto(ServiceRequest r) => new(
        r.Id,
        r.CreatedAt,
        r.Name,
        r.Phone,
        r.DirectionCode,
        ServiceDirections.Find(r.DirectionCode)?.Name ?? r.DirectionCode,
        r.Comment,
        r.Status);
}
