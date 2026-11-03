using PoliValko.Infrastructure.Outbox;

namespace PoliValko.UnitTests;

public sealed class OutboxRetryPolicyTests
{
    [Theory]
    [InlineData(1, 1)]
    [InlineData(2, 5)]
    [InlineData(3, 15)]
    [InlineData(4, 60)]
    [InlineData(99, 360)]
    public void Delay_grows_with_attempts_and_is_capped(int attempts, int expectedMinutes) =>
        OutboxRetryPolicy.NextDelay(attempts).ShouldBe(TimeSpan.FromMinutes(expectedMinutes));
}
