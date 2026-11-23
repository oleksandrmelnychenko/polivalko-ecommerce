using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.UnitTests.Catalog;

public sealed class CachedLoadTests : IDisposable
{
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly TimeSpan Life = TimeSpan.FromMinutes(1);
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Requests_that_arrive_together_wait_for_one_load_and_share_its_answer()
    {
        var loads = 0;
        var release = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<(string, bool)> Load()
        {
            Interlocked.Increment(ref loads);
            return (await release.Task, true);
        }
        var waiting = Enumerable.Range(0, 5).Select(_ => CachedLoad.GetAsync(_cache, "key", _gate, Life, Load, Ct)).ToArray();

        // The first request holds the gate inside its load; the others have not started one.
        waiting.ShouldAllBe(request => !request.IsCompleted);
        loads.ShouldBe(1);
        release.SetResult("answer");

        (await Task.WhenAll(waiting)).ShouldAllBe(answer => answer == "answer");
        loads.ShouldBe(1);
        (await CachedLoad.GetAsync(_cache, "key", _gate, Life, Load, Ct)).ShouldBe("answer");
        loads.ShouldBe(1);
    }

    [Fact]
    public async Task An_answer_not_worth_keeping_serves_one_request_only()
    {
        var loads = 0;
        Task<(string, bool)> Load(bool keep) => Task.FromResult(("answer " + ++loads, keep));

        (await CachedLoad.GetAsync(_cache, "key", _gate, Life, () => Load(false), Ct)).ShouldBe("answer 1");
        (await CachedLoad.GetAsync(_cache, "key", _gate, Life, () => Load(true), Ct)).ShouldBe("answer 2");
        (await CachedLoad.GetAsync(_cache, "key", _gate, Life, () => Load(true), Ct)).ShouldBe("answer 2");
        loads.ShouldBe(2);
    }

    [Fact]
    public async Task A_failed_load_is_not_kept_and_lets_the_next_request_try()
    {
        await Should.ThrowAsync<InvalidOperationException>(() => CachedLoad.GetAsync<string>(_cache, "key", _gate, Life,
            () => throw new InvalidOperationException("no database"), Ct));

        (await CachedLoad.GetAsync(_cache, "key", _gate, Life, () => Task.FromResult(("answer", true)), Ct)).ShouldBe("answer");
    }

    public void Dispose()
    {
        _cache.Dispose();
        _gate.Dispose();
    }
}
