using PoliValko.Content.Domain;

namespace PoliValko.Content.Features.ServiceRequests.Console;

internal static class ConsoleServiceRequestMapping
{
    public static ConsoleServiceRequestDto ToDto(ServiceRequest r) => new(
        r.Id,
        r.CreatedAt,
        r.Name,
        r.Phone,
        r.DirectionCode,
        ServiceDirections.Find(r.DirectionCode)?.Name ?? r.DirectionCode,
        r.Comment,
        r.Status);
}
