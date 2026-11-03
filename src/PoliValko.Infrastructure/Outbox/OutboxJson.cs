using System.Text.Json;

namespace PoliValko.Infrastructure.Outbox;

internal static class OutboxJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}
