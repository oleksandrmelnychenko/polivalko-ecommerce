using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Console.Features.Audit;
using PoliValko.Content;
using PoliValko.Content.Domain;
using PoliValko.Content.Features.Site;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class SiteHomeApiTests(ApiFactory api)
{
    private const string Banners = "/api/v1/console/site/banners";
    private const string Home = "/api/v1/console/site/home";
    private const string Image = "/api/media/content/2026/11/banner.webp";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Banners_are_created_reordered_and_shown_on_home_only_within_their_period()
    {
        var admin = await Staff.AdminAsync(api);
        var original = await admin.ReadAsync<List<BannerDto>>(Banners);
        var now = DateTimeOffset.UtcNow;
        var created = new List<BannerDto>();
        try
        {
            api.Storefront.Tags.Clear();
            var live = await CreateAsync(admin, Request("Весняний полив") with { EndsAt = now.AddDays(3), Link = "/catalog/polyv", ButtonLabel = "До поливу", Kicker = "Сезон" });
            var scheduled = await CreateAsync(admin, Request("Літній розпродаж") with { StartsAt = now.AddDays(5) });
            var ended = await CreateAsync(admin, Request("Минула акція") with { StartsAt = now.AddDays(-10), EndsAt = now.AddDays(-1) });
            var off = await CreateAsync(admin, Request("Вимкнений банер") with { IsActive = false });
            created.AddRange([live, scheduled, ended, off]);
            live.SortOrder.ShouldBeGreaterThan(original.Count == 0 ? 0 : original.Max(b => b.SortOrder));
            api.Storefront.Tags.ShouldContain("site");
            api.Storefront.Tags.ShouldContain("home");
            api.Storefront.Tags.ShouldContain("content");

            var home = await api.CreateClient().GetFromJsonAsync<SiteHomeDto>("/api/v1/site/home", TestJson.Options, Ct);
            var ids = home!.Banners.Select(b => b.Id).ToList();
            ids.ShouldContain(live.Id);
            ids.ShouldNotContain(scheduled.Id);
            ids.ShouldNotContain(ended.Id);
            ids.ShouldNotContain(off.Id);
            var shown = home.Banners.Single(b => b.Id == live.Id);
            (shown.Link, shown.ButtonLabel, shown.ImageUrl, shown.Kicker).ShouldBe(("/catalog/polyv", "До поливу", Image, "Сезон"));

            var updated = await (await admin.PutAsJsonAsync($"{Banners}/{scheduled.Id}", Request("Літній розпродаж") with { StartsAt = now.AddHours(-1) }, TestJson.Options, Ct))
                .ReadAsync<BannerDto>();
            updated.StartsAt.ShouldNotBeNull();

            var all = await admin.ReadAsync<List<BannerDto>>(Banners);
            var reversed = all.Select(b => b.Id).Reverse().ToList();
            var reordered = await (await admin.PutAsJsonAsync($"{Banners}/order", new ReorderBannersRequest(reversed), TestJson.Options, Ct))
                .ReadAsync<List<BannerDto>>();
            reordered.Select(b => b.Id).ShouldBe(reversed);
            reordered.Select(b => b.SortOrder).ShouldBe(Enumerable.Range(1, reversed.Count));

            var after = await api.CreateClient().GetFromJsonAsync<SiteHomeDto>("/api/v1/site/home", TestJson.Options, Ct);
            var order = after!.Banners.Select(b => b.Id).ToList();
            order.IndexOf(scheduled.Id).ShouldBeLessThan(order.IndexOf(live.Id));

            var partial = await admin.PutAsJsonAsync($"{Banners}/order", new ReorderBannersRequest([live.Id]), TestJson.Options, Ct);
            partial.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await partial.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["ids"]);

            (await admin.DeleteAsync($"{Banners}/{off.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
            created.Remove(off);
            (await admin.DeleteAsync($"{Banners}/{off.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
            (await admin.PutAsJsonAsync($"{Banners}/{Guid.NewGuid()}", Request("Немає"), TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

            var audit = await admin.ReadAsync<PagedResponse<AuditEntryDto>>("/api/v1/console/audit?entityType=Banner&pageSize=100");
            audit.Items.ShouldContain(e => e.Action == "site.banner_created" && e.EntityId == live.Id.ToString());
            audit.Items.ShouldContain(e => e.Action == "site.banner_updated" && e.EntityId == scheduled.Id.ToString());
            audit.Items.ShouldContain(e => e.Action == "site.banners_reordered");
            audit.Items.ShouldContain(e => e.Action == "site.banner_deleted" && e.EntityId == off.Id.ToString());
        }
        finally
        {
            foreach (var banner in created)
            {
                await admin.DeleteAsync($"{Banners}/{banner.Id}", Ct);
            }

            if (original.Count > 0)
            {
                await admin.PutAsJsonAsync($"{Banners}/order", new ReorderBannersRequest(original.Select(b => b.Id).ToList()), TestJson.Options, Ct);
            }
        }
    }

    [Fact]
    public async Task Invalid_banner_is_rejected_and_manager_has_no_access()
    {
        var admin = await Staff.AdminAsync(api);
        var invalid = await admin.PostAsJsonAsync(Banners, new SaveBannerRequest(
            "", new string('т', 201), new string('к', 31), "javascript:alert(1)", null, "ftp://x", DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(-1), true),
            TestJson.Options, Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys
            .ShouldBe(["title", "text", "buttonLabel", "link", "imageUrl", "mobileImageUrl", "endsAt"], ignoreOrder: true);

        var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync(Banners, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.PostAsJsonAsync(Banners, Request("Менеджер"), TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.GetAsync(Home, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.PutAsJsonAsync(Home, HomeSettingsStore.Defaults, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Home_settings_round_trip_and_announcement_shows_only_while_active()
    {
        var admin = await Staff.AdminAsync(api);
        var original = await admin.ReadAsync<HomeSettingsDto>(Home);
        try
        {
            var blocks = original.Blocks.Reverse().Select(b => b with { Visible = b.Key != "steps" }).ToList();
            var now = DateTimeOffset.UtcNow;
            var settings = new HomeSettingsDto(
                blocks,
                new HomeAnnouncementDto("  Знижки на полив до неділі  ", "/catalog?onSale=true", true, now.AddDays(-1), now.AddDays(2)),
                [new("Доставка", "Новою поштою"), new("Самовивіз", "У Бучі")],
                [new("Оберіть", "Товари"), new("Оформіть", "Без реєстрації"), new("Отримайте", "Швидко")],
                new HomeItemDto("Наш магазин", "Приходьте"));
            api.Storefront.Tags.Clear();
            var saved = await (await admin.PutAsJsonAsync(Home, settings, TestJson.Options, Ct)).ReadAsync<HomeSettingsDto>();
            saved.Announcement.Text.ShouldBe("Знижки на полив до неділі");
            saved.Blocks.Select(b => b.Key).ShouldBe(blocks.Select(b => b.Key));
            api.Storefront.Tags.ShouldBe(["content", "site", "home"], ignoreOrder: true);

            var loaded = await admin.ReadAsync<HomeSettingsDto>(Home);
            loaded.Blocks.ShouldBe(saved.Blocks);
            loaded.Perks.ShouldBe(saved.Perks);
            loaded.Steps.ShouldBe(saved.Steps);
            loaded.Visit.ShouldBe(new HomeItemDto("Наш магазин", "Приходьте"));

            var home = await api.CreateClient().GetFromJsonAsync<SiteHomeDto>("/api/v1/site/home", TestJson.Options, Ct);
            home!.Announcement!.Text.ShouldBe("Знижки на полив до неділі");
            home.Blocks.Single(b => b.Key == "steps").Visible.ShouldBeFalse();
            home.Perks.Select(p => p.Title).ShouldBe(["Доставка", "Самовивіз"]);

            await (await admin.PutAsJsonAsync(Home, settings with { Announcement = settings.Announcement with { StartsAt = now.AddDays(1) } }, TestJson.Options, Ct))
                .ReadAsync<HomeSettingsDto>();
            (await api.CreateClient().GetFromJsonAsync<SiteHomeDto>("/api/v1/site/home", TestJson.Options, Ct))!.Announcement.ShouldBeNull();

            var invalid = await admin.PutAsJsonAsync(Home, settings with
            {
                Blocks = [new("banner-wall", true)],
                Announcement = new HomeAnnouncementDto("", "javascript:x", true, now, now.AddDays(-1)),
                Perks = [new("", "Без заголовка")],
                Visit = new HomeItemDto("", ""),
            }, TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(
                ["blocks", "announcement.text", "announcement.link", "announcement.endsAt", "perks[0].title", "visit.title"],
                ignoreOrder: true);

            var audit = await admin.ReadAsync<PagedResponse<AuditEntryDto>>("/api/v1/console/audit?entityType=SiteHome");
            audit.Items.ShouldContain(e => e.Action == "site.home_updated");
        }
        finally
        {
            await admin.PutAsJsonAsync(Home, original, TestJson.Options, Ct);
        }
    }

    [Fact]
    public async Task Startup_seed_fills_only_empty_site_data()
    {
        var seeded = await api.WithDbAsync(db => db.Set<Banner>().AsNoTracking().Select(b => b.Title).ToListAsync(Ct));
        seeded.ShouldContain("Товари для саду, городу й дому");
        seeded.ShouldContain("Товари зі знижкою");

        await api.WithScopeAsync(async services =>
        {
            await ContentModule.SeedSiteAsync(services, Ct);
            return true;
        });

        (await api.WithDbAsync(db => db.Set<Banner>().CountAsync(Ct))).ShouldBe(seeded.Count);
        var admin = await Staff.AdminAsync(api);
        var home = await admin.ReadAsync<HomeSettingsDto>(Home);
        home.Blocks.Select(b => b.Key).ShouldBe(HomeSettingsStore.BlockKeys, ignoreOrder: true);
    }

    private static SaveBannerRequest Request(string title) =>
        new(title, "Текст банера", null, null, Image, null, null, null, true);

    private async Task<BannerDto> CreateAsync(HttpClient admin, SaveBannerRequest request) =>
        await (await admin.PostAsJsonAsync(Banners, request, TestJson.Options, Ct)).ReadAsync<BannerDto>(HttpStatusCode.Created);
}
