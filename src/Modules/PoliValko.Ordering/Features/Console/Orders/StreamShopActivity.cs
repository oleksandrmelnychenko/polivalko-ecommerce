using Microsoft.AspNetCore.Http;
using PoliValko.Ordering.Features.Activity;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class StreamShopActivity
{
    private static readonly TimeSpan KeepAliveInterval = TimeSpan.FromSeconds(15);
    // Close cleanly before Vercel's 300s runtime request timeout so EventSource reconnects silently with HTTP 200.
    private static readonly TimeSpan MaxStreamDuration = TimeSpan.FromSeconds(240);

    public static async Task HandleAsync(HttpContext http, ShopActivityHub hub, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-cache, no-store";
        http.Response.Headers["X-Accel-Buffering"] = "no";
        http.Response.ContentType = "text/event-stream; charset=utf-8";

        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(ct);
        lifetime.CancelAfter(MaxStreamDuration);
        var token = lifetime.Token;

        var reader = hub.Subscribe(out var subscriberId);
        try
        {
            await http.Response.WriteAsync("retry: 1500\n: connected\n\n", token);
            await http.Response.Body.FlushAsync(token);

            while (!token.IsCancellationRequested)
            {
                using var keepAlive = CancellationTokenSource.CreateLinkedTokenSource(token);
                keepAlive.CancelAfter(KeepAliveInterval);
                try
                {
                    if (!await reader.WaitToReadAsync(keepAlive.Token)) break;
                    long latest = 0;
                    while (reader.TryRead(out var seq)) latest = seq;
                    if (latest > 0)
                    {
                        await http.Response.WriteAsync($"event: activity\ndata: {latest}\n\n", token);
                        await http.Response.Body.FlushAsync(token);
                    }
                }
                catch (OperationCanceledException) when (!token.IsCancellationRequested)
                {
                    await http.Response.WriteAsync(": ping\n\n", token);
                    await http.Response.Body.FlushAsync(token);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Client disconnected or max stream duration reached; EventSource reconnects automatically.
        }
        finally
        {
            hub.Unsubscribe(subscriberId);
        }
    }
}
