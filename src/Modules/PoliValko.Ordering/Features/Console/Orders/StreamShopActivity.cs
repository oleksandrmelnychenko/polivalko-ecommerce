using Microsoft.AspNetCore.Http;
using PoliValko.Ordering.Features.Activity;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class StreamShopActivity
{
    private static readonly TimeSpan KeepAliveInterval = TimeSpan.FromSeconds(15);

    public static async Task HandleAsync(HttpContext http, ShopActivityHub hub, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-cache, no-store";
        http.Response.Headers["X-Accel-Buffering"] = "no";
        http.Response.ContentType = "text/event-stream; charset=utf-8";

        var reader = hub.Subscribe(out var subscriberId);
        try
        {
            await http.Response.WriteAsync(": connected\n\n", ct);
            await http.Response.Body.FlushAsync(ct);

            while (!ct.IsCancellationRequested)
            {
                using var keepAlive = CancellationTokenSource.CreateLinkedTokenSource(ct);
                keepAlive.CancelAfter(KeepAliveInterval);
                try
                {
                    if (!await reader.WaitToReadAsync(keepAlive.Token)) break;
                    long latest = 0;
                    while (reader.TryRead(out var seq)) latest = seq;
                    if (latest > 0)
                    {
                        await http.Response.WriteAsync($"event: activity\ndata: {latest}\n\n", ct);
                        await http.Response.Body.FlushAsync(ct);
                    }
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    await http.Response.WriteAsync(": ping\n\n", ct);
                    await http.Response.Body.FlushAsync(ct);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Client disconnected.
        }
        finally
        {
            hub.Unsubscribe(subscriberId);
        }
    }
}
