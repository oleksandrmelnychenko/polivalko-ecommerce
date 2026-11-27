using System.Collections.Concurrent;
using System.Threading.Channels;

namespace PoliValko.Ordering.Features.Activity;

internal sealed class ShopActivityHub
{
    private readonly ConcurrentDictionary<Guid, Channel<long>> _subscribers = new();
    private long _sequence;

    public long Publish()
    {
        var seq = Interlocked.Increment(ref _sequence);
        foreach (var (_, channel) in _subscribers)
        {
            channel.Writer.TryWrite(seq);
        }

        return seq;
    }

    public ChannelReader<long> Subscribe(out Guid id)
    {
        id = Guid.NewGuid();
        var channel = Channel.CreateBounded<long>(new BoundedChannelOptions(16)
        {
            SingleReader = true,
            SingleWriter = false,
            FullMode = BoundedChannelFullMode.DropOldest,
        });
        _subscribers[id] = channel;
        return channel.Reader;
    }

    public void Unsubscribe(Guid id)
    {
        if (_subscribers.TryRemove(id, out var channel))
        {
            channel.Writer.TryComplete();
        }
    }
}
