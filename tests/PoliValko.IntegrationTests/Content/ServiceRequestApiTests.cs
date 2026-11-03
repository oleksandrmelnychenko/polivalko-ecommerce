using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Content.Features.ServiceRequests;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.IntegrationTests;

public sealed class ServiceRequestApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Request_without_idempotency_key_is_rejected()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/service-requests", ValidRequest(), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("idempotency.key_required");
    }

    [Fact]
    public async Task Repeated_request_with_same_key_creates_one_request_and_replays_response()
    {
        var key = Guid.NewGuid().ToString();
        var phone = UniquePhone();
        var body = ValidRequest(phone);

        var first = await PostAsync(body, key);
        var second = await PostAsync(body, key);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.Headers.GetValues("Idempotent-Replayed").ShouldBe(["true"]);
        (await second.Content.ReadFromJsonAsync<ServiceRequestCreated>(Ct))
            .ShouldBe(await first.Content.ReadFromJsonAsync<ServiceRequestCreated>(Ct));

        var saved = await api.WithDbAsync(db => db.Set<ServiceRequest>().CountAsync(r => r.Phone == phone, Ct));
        saved.ShouldBe(1);
    }

    [Fact]
    public async Task Concurrent_requests_with_same_key_create_one_request()
    {
        var key = Guid.NewGuid().ToString();
        var phone = UniquePhone();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => PostAsync(ValidRequest(phone), key)));

        responses.ShouldAllBe(r => r.StatusCode == HttpStatusCode.Created || r.StatusCode == HttpStatusCode.Conflict);
        var saved = await api.WithDbAsync(db => db.Set<ServiceRequest>().CountAsync(r => r.Phone == phone, Ct));
        saved.ShouldBe(1);
    }

    [Fact]
    public async Task Same_key_with_different_body_is_rejected()
    {
        var key = Guid.NewGuid().ToString();
        (await PostAsync(ValidRequest(), key)).StatusCode.ShouldBe(HttpStatusCode.Created);

        var response = await PostAsync(ValidRequest() with { Comment = "інший коментар" }, key);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("idempotency.key_mismatch");
    }

    [Fact]
    public async Task Validation_errors_are_returned_and_key_can_be_reused_after_fix()
    {
        var key = Guid.NewGuid().ToString();

        var invalid = await PostAsync(new CreateServiceRequest("О", "123", "unknown", null), key);

        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct);
        problem!.Code.ShouldBe("validation.failed");
        problem.Errors!.Keys.ShouldBe(["name", "phone", "direction"], ignoreOrder: true);

        (await PostAsync(ValidRequest(), key)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Malformed_json_returns_bad_request_problem()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/service-requests")
        {
            Content = new StringContent("{\"name\": ", Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());

        var response = await _client.SendAsync(request, Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("request.invalid");
    }

    [Fact]
    public async Task Created_request_notifies_manager_through_outbox()
    {
        var phone = UniquePhone();
        (await PostAsync(ValidRequest(phone), Guid.NewGuid().ToString())).StatusCode.ShouldBe(HttpStatusCode.Created);

        await api.ProcessOutboxAsync();

        api.Notifier.Sent.ShouldContain(n => n.Title == "Нова заявка на послугу" && n.Body.Contains(phone));
        var pending = await api.WithDbAsync(db =>
            db.OutboxMessages.CountAsync(m => m.Type == "content.service-request-submitted" && m.Status != OutboxStatus.Processed, Ct));
        pending.ShouldBe(0);
    }

    [Fact]
    public async Task Failed_outbox_message_is_rescheduled_with_error()
    {
        var marker = Guid.NewGuid().ToString("N");
        await api.WithScopeAsync(services =>
        {
            services.GetRequiredService<IOutbox>().Enqueue(new AlwaysFailingMessage(marker));
            return services.GetRequiredService<PoliValkoDbContext>().SaveChangesAsync(Ct);
        });

        await api.ProcessOutboxAsync();

        var messages = await api.WithDbAsync(db =>
            db.OutboxMessages.AsNoTracking().Where(m => m.Type == AlwaysFailingMessage.Type).ToListAsync(Ct));
        var message = messages.Single(m => m.Payload.Contains(marker, StringComparison.Ordinal));
        message.Status.ShouldBe(OutboxStatus.Pending);
        message.Attempts.ShouldBe(1);
        message.NextAttemptAt.ShouldBeGreaterThan(DateTimeOffset.UtcNow.AddSeconds(30));
        message.LockedUntil.ShouldBeNull();
        message.LastError!.ShouldContain("Navkolo недоступна");
    }

    private Task<HttpResponseMessage> PostAsync(CreateServiceRequest body, string key)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/service-requests") { Content = JsonContent.Create(body) };
        request.Headers.Add("Idempotency-Key", key);
        return _client.SendAsync(request, Ct);
    }

    private static CreateServiceRequest ValidRequest(string? phone = null) =>
        new("Олена", phone ?? UniquePhone(), "lawns", "Газон біля будинку, 2 сотки");

    private static string UniquePhone() => $"+38067{Random.Shared.Next(1_000_000, 9_999_999)}";
}
