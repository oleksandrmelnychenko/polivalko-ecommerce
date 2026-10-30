using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Notifications;

namespace PoliValko.Content;

public sealed record ServiceRequestSubmitted(Guid ServiceRequestId) : IOutboxMessage
{
    public static string Type => "content.service-request-submitted";
}

internal sealed class NotifyManagerOnServiceRequest(PoliValkoDbContext db, IManagerNotifier notifier)
    : IOutboxHandler<ServiceRequestSubmitted>
{
    public async Task HandleAsync(ServiceRequestSubmitted message, CancellationToken cancellationToken)
    {
        var request = await db.Set<ServiceRequest>()
            .AsNoTracking()
            .SingleAsync(r => r.Id == message.ServiceRequestId, cancellationToken);

        var direction = ServiceDirections.Find(request.DirectionCode)?.Name ?? request.DirectionCode;
        var body = $"{direction}\n{request.Name}, {request.Phone}";
        if (request.Comment is not null)
        {
            body += $"\n\n{request.Comment}";
        }

        await notifier.NotifyAsync(new ManagerNotification("Нова заявка на послугу", body), cancellationToken);
    }
}
