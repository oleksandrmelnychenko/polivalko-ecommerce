using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PoliValko.Console.Features.Media;
using PoliValko.Identity.Features.Permissions;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleMediaAndPermissionApiTests(ApiFactory api)
{
    private const string Upload = "/api/v1/console/media/images";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Content_images_are_uploaded_by_staff_with_a_content_permission()
    {
        var admin = await Staff.AdminAsync(api);
        var uploaded = await (await admin.PostAsync(Upload, Image([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, .. new byte[32]], "banner.png"), Ct))
            .ReadAsync<UploadedImageDto>();
        uploaded.Url.ShouldStartWith("/api/media/content/");
        uploaded.Url.ShouldEndWith(".png");
        (await api.CreateClient().GetAsync(uploaded.Url, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var text = await admin.PostAsync(Upload, Image("not an image"u8.ToArray(), "notes.txt"), Ct);
        text.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await text.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("file");

        var manager = await Staff.ManagerAsync(api);
        (await manager.PostAsync(Upload, Image([0xFF, 0xD8, 0xFF, 0xE0, .. new byte[16]], "photo.jpg"), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var brandEditor = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.BrandsManage);
        (await brandEditor.PostAsync(Upload, Image([0xFF, 0xD8, 0xFF, 0xE0, .. new byte[16]], "logo.jpg"), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Catalog_has_new_keys_sections_and_manager_defaults()
    {
        var admin = await Staff.AdminAsync(api);
        var catalog = await admin.ReadAsync<PermissionCatalogDto>("/api/v1/console/permissions/catalog");
        catalog.Version.ShouldBe("2026-11-06.1");
        var byKey = catalog.Permissions.ToDictionary(p => p.Key);
        foreach (var (key, section) in new[]
                 {
                     (PermissionKeys.AttributesManage, "catalog"),
                     (PermissionKeys.BrandsManage, "catalog"),
                     (PermissionKeys.LabelsManage, "catalog"),
                     (PermissionKeys.SiteHomeManage, "site"),
                     (PermissionKeys.SiteSeoManage, "site"),
                     (PermissionKeys.SiteContentManage, "site"),
                     (PermissionKeys.RedirectsManage, "site"),
                     (PermissionKeys.SettingsShopManage, "settings"),
                     (PermissionKeys.SettingsNotificationsManage, "settings"),
                     (PermissionKeys.PickupManage, "settings"),
                     (PermissionKeys.CustomerAccountsManage, "customers"),
                 })
        {
            byKey[key].SectionId.ShouldBe(section);
        }

        byKey[PermissionKeys.SiteContentManage].Name.ShouldBe("Сторінки й послуги");
        byKey[PermissionKeys.RedirectsManage].Name.ShouldBe("Перенаправлення адрес (SEO)");
        byKey[PermissionKeys.PickupManage].Name.ShouldBe("Доставка й самовивіз");
        byKey[PermissionKeys.SettingsShopManage].Risk.ShouldBe(PermissionRisk.High);
        byKey[PermissionKeys.CustomerAccountsManage].Risk.ShouldBe(PermissionRisk.High);

        var mine = await admin.ReadAsync<MyPermissionsDto>("/api/v1/console/permissions/me");
        mine.PermissionKeys.ShouldContain(PermissionKeys.SettingsNotificationsManage);
        var managerKeys = (await (await Staff.ManagerAsync(api)).ReadAsync<MyPermissionsDto>("/api/v1/console/permissions/me")).PermissionKeys;
        managerKeys.ShouldContain(PermissionKeys.LabelsManage);
        managerKeys.ShouldNotContain(PermissionKeys.AttributesManage);
        managerKeys.ShouldNotContain(PermissionKeys.BrandsManage);
        managerKeys.ShouldNotContain(PermissionKeys.CustomerAccountsManage);
        managerKeys.ShouldNotContain(PermissionKeys.SettingsShopManage);
    }

    [Fact]
    public async Task Shop_contacts_need_shop_settings_permission()
    {
        var admin = await Staff.AdminAsync(api);
        var pagesOnly = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.SiteContentManage);
        (await pagesOnly.GetAsync("/api/v1/console/content/pages", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await pagesOnly.GetAsync("/api/v1/console/content/services", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await pagesOnly.GetAsync("/api/v1/console/content/contacts", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var shop = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.SettingsShopManage);
        (await shop.GetAsync("/api/v1/console/content/contacts", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await shop.GetAsync("/api/v1/console/content/pages", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private static MultipartFormDataContent Image(byte[] bytes, string fileName)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "file", fileName);
        return form;
    }
}
