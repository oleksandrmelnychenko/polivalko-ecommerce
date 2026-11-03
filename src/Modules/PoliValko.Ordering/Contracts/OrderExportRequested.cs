using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Ordering.Contracts;

public sealed record OrderExportRequested(Guid OrderId) : IOutboxMessage
{
    public static string Type => "ordering.export-requested";
}
