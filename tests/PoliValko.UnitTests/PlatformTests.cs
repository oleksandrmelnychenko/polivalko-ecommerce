using PoliValko.Content.Api;
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

public sealed class ServiceRequestValidationTests
{
    [Fact]
    public void Valid_request_normalizes_phone()
    {
        var errors = ServiceRequestEndpoints.Validate(new CreateServiceRequest("Олена", "067 123 45 67", "lawns", null), out var phone);

        errors.ShouldBeEmpty();
        phone.ShouldBe("+380671234567");
    }

    [Fact]
    public void Invalid_request_reports_every_field()
    {
        var errors = ServiceRequestEndpoints.Validate(
            new CreateServiceRequest("О", "123", "unknown", new string('x', 1001)),
            out _);

        errors.Keys.ShouldBe(["name", "phone", "direction", "comment"], ignoreOrder: true);
    }
}
