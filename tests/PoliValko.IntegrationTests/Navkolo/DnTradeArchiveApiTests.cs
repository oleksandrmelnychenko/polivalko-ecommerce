using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Navkolo.Features.SalesArchive;

namespace PoliValko.IntegrationTests;

public sealed class DnTradeArchiveApiTests(ApiFactory api)
{
    private const string Url = "/api/v1/console/dntrade-archive";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Staff_permissions_protect_archive_reads_and_import()
    {
        var account = "test-" + Guid.NewGuid().ToString("N");
        using var guest = api.CreateClient();
        using var manager = await Staff.ManagerAsync(api);
        using var admin = await Staff.AdminAsync(api);

        (await guest.GetAsync(Url, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await manager.GetAsync(Url, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.GetAsync($"{Url}/{Guid.NewGuid()}", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Upload(manager, account, Sale("test-sale"), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.GetAsync($"{Url}/{Guid.NewGuid()}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Archive_retains_source_payload_but_reads_only_normalized_fields_and_rejects_changes_atomically()
    {
        var account = "test-" + Guid.NewGuid().ToString("N");
        const string sensitive = "private-test-phone";
        var sale = Sale("same", sensitive);
        var otherCollection = Sale("same").Replace("\"invoice\"", "\"order\"", StringComparison.Ordinal);
        using var admin = await Staff.AdminAsync(api);

        var first = await (await Upload(admin, account, sale + "\n" + otherCollection, Ct))
            .ReadAsync<DnTradeArchiveImportDto>(HttpStatusCode.OK);
        first.ShouldBe(new DnTradeArchiveImportDto(2, 0));
        var repeated = await (await Upload(admin, account, sale, Ct)).ReadAsync<DnTradeArchiveImportDto>(HttpStatusCode.OK);
        repeated.ShouldBe(new DnTradeArchiveImportDto(0, 1));

        var filter = $"{Url}?sourceAccount={account}&entityType=invoice&from=2021-01-01&to=2021-01-01&storeId=store-1";
        var archive = await (await admin.GetAsync(filter, Ct)).ReadAsync<DnTradeArchivePageDto>(HttpStatusCode.OK);
        archive.Total.ShouldBe(1);
        var record = archive.Items.ShouldHaveSingleItem();
        record.Total.ShouldBe(-25.5m);
        record.SourceDate.ShouldBe("2021-01-01T23:50:00-05:00");
        var detail = await admin.GetStringAsync($"{Url}/{record.Id}", Ct);
        detail.ShouldNotContain(sensitive);
        detail.ShouldNotContain("\"raw\"");
        (await api.WithDbAsync(db => db.Set<DnTradeArchiveRecord>().Where(x => x.Id == record.Id).Select(x => x.Payload).SingleAsync(Ct)))
            .ShouldContain(sensitive);

        var conflict = await Upload(admin, account, Sale("new") + "\n" + Sale("same", "different"), Ct);
        conflict.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await api.WithDbAsync(db => db.Set<DnTradeArchiveRecord>().CountAsync(x => x.SourceAccount == account, Ct))).ShouldBe(2);
    }

    [Fact]
    public async Task Original_file_requires_its_own_permission_and_preserves_the_uploaded_envelope_bytes()
    {
        var account = "test-" + Guid.NewGuid().ToString("N");
        var original = " " + Sale("original", "приватн\\u0435") + " ";
        using var admin = await Staff.AdminAsync(api);
        using var staffImporter = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.DnTradeArchiveView, PermissionKeys.DnTradeArchiveImport);
        using var guest = api.CreateClient();

        (await Upload(staffImporter, account, original, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var record = (await staffImporter.ReadAsync<DnTradeArchivePageDto>($"{Url}?sourceAccount={account}")).Items.ShouldHaveSingleItem();
        (await staffImporter.GetAsync($"{Url}/{record.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var originalUrl = $"{Url}/{record.Id}/original";
        (await guest.GetAsync(originalUrl, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await staffImporter.GetAsync(originalUrl, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.GetAsync($"{Url}/{Guid.NewGuid()}/original", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        using var attachment = await admin.GetAsync(originalUrl, Ct);
        attachment.StatusCode.ShouldBe(HttpStatusCode.OK);
        attachment.Headers.CacheControl!.NoStore.ShouldBeTrue();
        attachment.Content.Headers.ContentType!.MediaType.ShouldBe("application/json");
        attachment.Content.Headers.ContentDisposition!.DispositionType.ShouldBe("attachment");
        attachment.Content.Headers.ContentDisposition.FileNameStar.ShouldBe($"dntrade-archive-{record.Id:N}.json");
        (await attachment.Content.ReadAsByteArrayAsync(Ct)).ShouldBe(Encoding.UTF8.GetBytes(original));
    }

    private static Task<HttpResponseMessage> Upload(HttpClient client, string account, string content, CancellationToken ct) =>
        client.PostAsync($"{Url}/import?sourceAccount={account}", new StringContent(content, Encoding.UTF8, DnTradeArchiveInput.ContentType), ct);

    private static string Sale(string id, string phone = "") => $$$"""
        {"schemaVersion":1,"source":"dntrade","entityType":"invoice","sourceId":"{{{id}}}","sourceDate":"2021-01-01T23:50:00-05:00","documentType":"return","storeIds":["store-1"],"currency":"UAH","total":"-25.5","raw":{"phone":"{{{phone}}}"}}
        """;
}
