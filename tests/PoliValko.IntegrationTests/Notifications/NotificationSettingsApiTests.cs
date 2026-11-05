using System.Net;
using System.Net.Http.Json;
using PoliValko.Console.Features.Audit;
using PoliValko.Content.Features.ServiceRequests;
using PoliValko.Notifications.Contracts;
using PoliValko.Notifications.Features.Settings;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class NotificationSettingsApiTests(ApiFactory api)
{
    private const string Settings = "/api/v1/console/settings/notifications";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Settings_round_trip_and_test_message_goes_to_saved_chats()
    {
        var admin = await Staff.AdminAsync(api);
        var original = await admin.ReadAsync<NotificationSettingsDto>(Settings);
        original.TelegramConfigured.ShouldBeTrue();
        try
        {
            var saved = await (await admin.PutAsJsonAsync(Settings, new SaveNotificationSettingsRequest(
                    [" -1001234567890 ", "@polivalko_shop", "-1001234567890"],
                    ["Manager@Example.com", "manager@example.com"],
                    new NotificationEventsDto(true, true, false, true)), TestJson.Options, Ct))
                .ReadAsync<NotificationSettingsDto>();
            saved.TelegramChatIds.ShouldBe(["-1001234567890", "@polivalko_shop"]);
            saved.Emails.ShouldBe(["manager@example.com"]);
            saved.Events.IntegrationAlert.ShouldBeFalse();
            saved.TelegramConfigured.ShouldBeTrue();
            var reloaded = await admin.ReadAsync<NotificationSettingsDto>(Settings);
            reloaded.TelegramChatIds.ShouldBe(saved.TelegramChatIds);
            reloaded.Emails.ShouldBe(saved.Emails);
            reloaded.Events.ShouldBe(saved.Events);

            var result = await (await admin.PostAsJsonAsync($"{Settings}/test", new { }, Ct)).ReadAsync<NotificationTestResultDto>();
            result.ShouldBe(new NotificationTestResultDto(2, 2));
            var delivery = api.Notifier.Deliveries.Last(d => d.Notification.Event == ManagerEvent.Test);
            delivery.Notification.Title.ShouldBe("Тестове повідомлення");
            delivery.ChatIds.ShouldBe(["-1001234567890", "@polivalko_shop"]);

            var invalid = await admin.PutAsJsonAsync(Settings, new SaveNotificationSettingsRequest(["not a chat"], ["broken"], null), TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["telegramChatIds", "emails"], ignoreOrder: true);

            await (await admin.PutAsJsonAsync(Settings, new SaveNotificationSettingsRequest([], [], null), TestJson.Options, Ct)).ReadAsync<NotificationSettingsDto>();
            var noChats = await admin.PostAsJsonAsync($"{Settings}/test", new { }, Ct);
            noChats.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            (await noChats.ProblemCodeAsync()).ShouldBe("notifications.no_recipients");

            var audit = await admin.ReadAsync<PagedResponse<AuditEntryDto>>("/api/v1/console/audit?entityType=NotificationSettings");
            audit.Items.ShouldContain(e => e.Action == "settings.notifications_updated");
            audit.Items.ShouldContain(e => e.Action == "settings.notifications_test_sent");

            var manager = await Staff.ManagerAsync(api);
            (await manager.GetAsync(Settings, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
            (await manager.PostAsJsonAsync($"{Settings}/test", new { }, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }
        finally
        {
            await admin.PutAsJsonAsync(Settings, new SaveNotificationSettingsRequest(original.TelegramChatIds, original.Emails, original.Events), TestJson.Options, Ct);
        }
    }

    [Fact]
    public async Task Disabled_event_is_not_sent_and_stored_chats_receive_enabled_ones()
    {
        var admin = await Staff.AdminAsync(api);
        var original = await admin.ReadAsync<NotificationSettingsDto>(Settings);
        var client = api.CreateClient();
        try
        {
            await (await admin.PutAsJsonAsync(Settings, new SaveNotificationSettingsRequest(
                    ["-1009876543210"], [], new NotificationEventsDto(true, false, true, true)), TestJson.Options, Ct))
                .ReadAsync<NotificationSettingsDto>();
            var muted = await SubmitServiceRequestAsync(client);
            await api.ProcessOutboxAsync();
            api.Notifier.Sent.ShouldNotContain(n => n.Body.Contains(muted));

            await (await admin.PutAsJsonAsync(Settings, new SaveNotificationSettingsRequest(
                    ["-1009876543210"], [], new NotificationEventsDto(true, true, true, true)), TestJson.Options, Ct))
                .ReadAsync<NotificationSettingsDto>();
            var heard = await SubmitServiceRequestAsync(client);
            await api.ProcessOutboxAsync();
            var delivery = api.Notifier.Deliveries.Single(d => d.Notification.Body.Contains(heard));
            delivery.Notification.Event.ShouldBe(ManagerEvent.NewServiceRequest);
            delivery.ChatIds.ShouldBe(["-1009876543210"]);
        }
        finally
        {
            await admin.PutAsJsonAsync(Settings, new SaveNotificationSettingsRequest(original.TelegramChatIds, original.Emails, original.Events), TestJson.Options, Ct);
        }
    }

    private async Task<string> SubmitServiceRequestAsync(HttpClient client)
    {
        var phone = $"+38063{Random.Shared.Next(1_000_000, 9_999_999)}";
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/service-requests")
        {
            Content = JsonContent.Create(new CreateServiceRequest("Олена", phone, "lawns", null)),
        };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        (await client.SendAsync(request, Ct)).StatusCode.ShouldBe(HttpStatusCode.Created);
        return phone;
    }
}
