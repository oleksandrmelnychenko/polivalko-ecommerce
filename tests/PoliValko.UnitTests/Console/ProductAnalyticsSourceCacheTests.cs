using Microsoft.Extensions.Caching.Memory;
using PoliValko.Console.Features.Analytics;
using PoliValko.SharedKernel;

namespace PoliValko.UnitTests.Console;

public sealed class ProductAnalyticsSourceCacheTests
{
    [Fact]
    public async Task Different_date_ranges_for_the_same_source_do_not_evict_each_other()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        using var cache = new ProductAnalyticsSourceCache(memory);
        var calls = 0;

        Task<ProductSalesData> Read(DateOnly from, DateOnly to, CancellationToken _)
        {
            calls++;
            return Task.FromResult(new ProductSalesData([], from, to, 0, 0, true));
        }

        var rangeA = (From: new DateOnly(2023, 1, 1), To: new DateOnly(2026, 1, 10));
        var rangeB = (From: new DateOnly(2023, 2, 1), To: new DateOnly(2026, 2, 10));

        await cache.ReadAsync("web", rangeA.From, rangeA.To, Read, TestContext.Current.CancellationToken);
        await cache.ReadAsync("web", rangeB.From, rangeB.To, Read, TestContext.Current.CancellationToken);
        await cache.ReadAsync("web", rangeA.From, rangeA.To, Read, TestContext.Current.CancellationToken);
        await cache.ReadAsync("web", rangeB.From, rangeB.To, Read, TestContext.Current.CancellationToken);

        calls.ShouldBe(2);
    }
}
