using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Infrastructure.Sync;

public sealed record IntegrationAlert(string Title, string Body) : IOutboxMessage
{
    public static string Type => "integration.alert";
}
