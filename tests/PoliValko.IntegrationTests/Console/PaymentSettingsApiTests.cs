using System.Net;
using PoliValko.Console.Features.Settings;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.IntegrationTests;

public sealed class PaymentSettingsApiTests(ApiFactory api)
{
    private const string Payments = "/api/v1/console/settings/payments";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Payment_and_receipt_settings_are_read_from_configuration()
    {
        var manager = await Staff.ManagerAsync(api);
        var settings = await manager.ReadAsync<PaymentSettingsDto>(Payments);

        (settings.Provider, settings.Mode).ShouldBe(("Sandbox", "Test"));
        (settings.FiscalProvider, settings.FiscalMode).ShouldBe(("Stub", "Stub"));
        settings.IssueOn.ShouldBe(new ReceiptIssueDto("payment", "completion", "none"));

        var admin = await Staff.AdminAsync(api);
        var viewer = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.ProductsView);
        (await viewer.GetAsync(Payments, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
