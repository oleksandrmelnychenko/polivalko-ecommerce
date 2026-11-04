using System.Net;
using System.Net.Http.Json;
using PoliValko.Console.Features.Integration;

namespace PoliValko.IntegrationTests;

public sealed class IntegrationApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Failed_operation_can_be_retried_manually()
    {
        var id = await api.WithDbAsync(async db =>
        {
            var message = new PoliValko.Infrastructure.Outbox.OutboxMessage
            {
                Id = Guid.CreateVersion7(),
                Type = "tests.always-failing",
                Payload = "{\"marker\":\"manual-retry\"}",
                OccurredAt = DateTimeOffset.UtcNow,
                NextAttemptAt = DateTimeOffset.UtcNow,
                Status = PoliValko.Infrastructure.Outbox.OutboxStatus.Failed,
                Attempts = 10,
                LastError = "Navkolo недоступна",
            };
            db.OutboxMessages.Add(message);
            await db.SaveChangesAsync(Ct);
            return message.Id;
        });

        var admin = await Staff.AdminAsync(api);
        var failed = await admin.GetFromJsonAsync<List<OutboxMessageDto>>("/api/v1/console/integration/outbox", TestJson.Options, Ct);
        failed!.ShouldContain(m => m.Id == id);

        (await admin.PostAsync($"/api/v1/console/integration/outbox/{id}/retry", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var status = await admin.GetFromJsonAsync<IntegrationStatusDto>("/api/v1/console/integration/status", TestJson.Options, Ct);
        status!.OutboxPending.ShouldBeGreaterThan(0);
        status.Jobs.ShouldContain(j => j.Job == "navkolo.price-stock");

        var manager = await Staff.ManagerAsync(api);
        (await manager.PostAsync($"/api/v1/console/integration/outbox/{id}/retry", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
