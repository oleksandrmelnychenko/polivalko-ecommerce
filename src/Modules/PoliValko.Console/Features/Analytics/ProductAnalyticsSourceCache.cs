using Microsoft.Extensions.Caching.Memory;
using PoliValko.SharedKernel;

namespace PoliValko.Console.Features.Analytics;

internal sealed class ProductAnalyticsSourceCache(IMemoryCache cache) : IDisposable
{
    private static readonly TimeSpan Expiration = TimeSpan.FromMinutes(2);
    private readonly SemaphoreSlim _website = new(1);
    private readonly SemaphoreSlim _archive = new(1);

    public async Task<ProductSalesData> ReadAsync(string source, DateOnly from, DateOnly to,
        Func<DateOnly, DateOnly, CancellationToken, Task<ProductSalesData>> read, CancellationToken ct)
    {
        var key = (typeof(ProductAnalyticsSourceCache), source, from, to);
        var gate = source == "web" ? _website : _archive;
        await gate.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue<ProductSalesData>(key, out var cached) && cached is not null)
            {
                return cached;
            }

            var sales = await read(from, to, ct);
            cache.Set(key, sales, Expiration);
            return sales;
        }
        finally
        {
            gate.Release();
        }
    }

    public void Dispose()
    {
        _website.Dispose();
        _archive.Dispose();
    }
}
