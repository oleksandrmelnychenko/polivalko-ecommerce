using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using PoliValko.Console;
using PoliValko.Catalog;
using PoliValko.Content;
using PoliValko.Customers;
using PoliValko.Delivery;
using PoliValko.Fiscal;
using PoliValko.Identity;
using PoliValko.Navkolo;
using PoliValko.Notifications;
using PoliValko.Ordering;
using PoliValko.Payments;
using Scalar.AspNetCore;

namespace PoliValko.Api.Composition;

public static class ApiEndpoints
{
    public static WebApplication MapPoliValkoEndpoints(this WebApplication app)
    {
        if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Api:ExposeDocs"))
        {
            app.MapOpenApi("/api/openapi/{documentName}.json");
            app.MapScalarApiReference("/api/docs", options => options.WithOpenApiRoutePattern("/api/openapi/{documentName}.json"));
        }

        var api = app.MapGroup("/api/v1");
        api.MapCatalogEndpoints();
        api.MapServiceRequestEndpoints();
        api.MapSiteContentEndpoints();
        api.MapDeliveryEndpoints();
        api.MapCheckoutEndpoints();
        api.MapPaymentEndpoints();
        api.MapReceiptEndpoints();
        api.MapSiteEndpoints();

        var console = api.MapGroup("/console");
        console.MapConsoleAuthEndpoints();
        console.MapConsoleStaffEndpoints();
        console.MapConsoleSummaryEndpoints();
        console.MapConsoleDashboardEndpoints();
        console.MapConsoleSearchEndpoints();
        console.MapConsoleOrderEndpoints();
        console.MapConsoleCustomerEndpoints();
        console.MapConsolePaymentEndpoints();
        console.MapConsoleReceiptEndpoints();
        console.MapConsoleCatalogEndpoints();
        console.MapConsoleSiteContentEndpoints();
        console.MapConsoleCatalogImportEndpoints();
        console.MapConsoleIntegrationEndpoints();
        console.MapConsoleServiceRequestEndpoints();
        console.MapConsoleDeliveryEndpoints();
        console.MapConsoleRefundEndpoints();
        console.MapConsoleAccountEndpoints();
        console.MapConsoleMediaEndpoints();
        console.MapConsoleSiteEndpoints();
        console.MapConsoleShopSettingsEndpoints();
        console.MapConsoleDeliverySettingsEndpoints();
        console.MapConsolePaymentSettingsEndpoints();
        console.MapConsoleNotificationSettingsEndpoints();

        api.MapAccountEndpoints();
        api.MapAccountOrderEndpoints();
        api.MapAccountReceiptEndpoints();
        api.MapAccountPaymentEndpoints();
        api.MapAccountFavoriteEndpoints();

        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });
        return app;
    }
}
