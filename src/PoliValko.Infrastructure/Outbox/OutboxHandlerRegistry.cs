using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;

namespace PoliValko.Infrastructure.Outbox;

public sealed class OutboxHandlerRegistry
{
    private readonly Dictionary<string, Func<IServiceProvider, string, CancellationToken, Task>> _handlers =
        new(StringComparer.Ordinal);

    public void Register<TMessage>()
        where TMessage : IOutboxMessage
    {
        _handlers[TMessage.Type] = (services, payload, ct) =>
        {
            var message = JsonSerializer.Deserialize<TMessage>(payload, OutboxJson.Options)
                ?? throw new InvalidOperationException($"Порожній payload повідомлення '{TMessage.Type}'.");
            return services.GetRequiredService<IOutboxHandler<TMessage>>().HandleAsync(message, ct);
        };
    }

    public Task DispatchAsync(IServiceProvider services, string type, string payload, CancellationToken ct) =>
        _handlers.TryGetValue(type, out var handler)
            ? handler(services, payload, ct)
            : throw new InvalidOperationException($"Немає обробника для повідомлення outbox '{type}'.");
}
