using PoliValko.Catalog;
using PoliValko.Content;
using PoliValko.Delivery;
using PoliValko.Fiscal;
using PoliValko.Infrastructure;
using PoliValko.Navkolo;
using PoliValko.Notifications;
using PoliValko.Ordering;
using PoliValko.Payments;

// Фонові процеси: outbox (передача в Navkolo, чеки, повідомлення), розклад синхронізацій.
// Працюють незалежно від браузера й від процесу API (розділ 2 ТЗ).
var builder = Host.CreateApplicationBuilder(args);

builder.Services
    .AddPoliValkoPersistence()
    .AddCatalogModule()
    .AddContentModule()
    .AddDeliveryModule(builder.Configuration)
    .AddOrderingModule(builder.Configuration)
    .AddPaymentsModule(builder.Configuration)
    .AddFiscalModule(builder.Configuration)
    .AddNavkoloModule(builder.Configuration)
    .AddNotificationsModule(builder.Configuration)
    .AddPlatformBackgroundServices()
    .AddDeliveryJobs()
    .AddPaymentsJobs()
    .AddNavkoloJobs();

await builder.Build().RunAsync();
