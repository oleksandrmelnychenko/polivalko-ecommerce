using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using PoliValko.Api;
using PoliValko.Catalog;
using PoliValko.Catalog.Api;
using PoliValko.Content;
using PoliValko.Content.Api;
using PoliValko.Delivery;
using PoliValko.Fiscal;
using PoliValko.Identity;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.Navkolo;
using PoliValko.Notifications;
using PoliValko.Ordering;
using PoliValko.Ordering.Api;
using PoliValko.Payments;
using PoliValko.Payments.Api;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddPoliValkoPersistence()
    .AddCatalogModule()
    .AddContentModule()
    .AddDeliveryModule(builder.Configuration)
    .AddOrderingModule(builder.Configuration)
    .AddPaymentsModule(builder.Configuration)
    .AddFiscalModule(builder.Configuration)
    .AddNavkoloModule(builder.Configuration)
    .AddIdentityModule()
    .AddNotificationsModule(builder.Configuration);

builder.Services.AddApiProblemDetails();
builder.Services.AddApiRateLimiting();
builder.Services.AddApiCors(builder.Configuration);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Числа лише як числа: у контракті OpenAPI integer не стає "integer | string".
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});
builder.Services.AddOpenApi("v1", options => options.AddDocumentTransformer((document, _, _) =>
{
    document.Info ??= new();
    document.Info.Title = "Poli Valko API";
    document.Info.Version = "v1";
    document.Info.Description = "Спільний API інтернет-магазину Poli Valko для вебу та майбутніх мобільних застосунків.";
    return Task.CompletedTask;
}));
builder.Services.AddHealthChecks().AddDbContextCheck<PoliValkoDbContext>("database", tags: ["ready"]);

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseMediaFiles();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Api:ExposeDocs"))
{
    // Під /api, щоб документація проходила через reverse proxy разом з API.
    app.MapOpenApi("/api/openapi/{documentName}.json");
    app.MapScalarApiReference("/api/docs", options => options.WithOpenApiRoutePattern("/api/openapi/{documentName}.json"));
}

var api = app.MapGroup("/api/v1");
api.MapCatalogEndpoints();
api.MapContentEndpoints();
api.MapSiteContentEndpoints();
api.MapDeliveryEndpoints();
api.MapOrderingEndpoints();
api.MapPaymentEndpoints();
api.MapFiscalEndpoints();

var admin = api.MapGroup("/admin");
admin.MapAdminAuthEndpoints();
admin.MapAdminStaffEndpoints();
admin.MapAdminSummary();
admin.MapAdminDashboard();
admin.MapAdminSearch();
admin.MapAdminOrderEndpoints();
admin.MapAdminCustomerEndpoints();
admin.MapAdminPaymentEndpoints();
admin.MapAdminFiscalEndpoints();
admin.MapAdminCatalogEndpoints();
admin.MapAdminSiteContentEndpoints();
admin.MapAdminNavkoloEndpoints();
admin.MapAdminIntegration();
admin.MapAdminServiceRequestEndpoints();
admin.MapAdminDeliveryEndpoints();

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

await app.PrepareDatabaseAsync();
await app.RunAsync();

public partial class Program;
