using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Content.Contracts;

public sealed record ServiceRequestSubmitted(Guid ServiceRequestId) : IOutboxMessage
{
    public static string Type => "content.service-request-submitted";
}
