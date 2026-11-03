using PoliValko.Content.Features.ServiceRequests;

namespace PoliValko.UnitTests;

public sealed class ServiceRequestValidationTests
{
    [Fact]
    public void Valid_request_normalizes_phone()
    {
        var errors = SubmitServiceRequest.Validate(new CreateServiceRequest("Олена", "067 123 45 67", "lawns", null), out var phone);

        errors.ShouldBeEmpty();
        phone.ShouldBe("+380671234567");
    }

    [Fact]
    public void Invalid_request_reports_every_field()
    {
        var errors = SubmitServiceRequest.Validate(
            new CreateServiceRequest("О", "123", "unknown", new string('x', 1001)),
            out _);

        errors.Keys.ShouldBe(["name", "phone", "direction", "comment"], ignoreOrder: true);
    }
}
