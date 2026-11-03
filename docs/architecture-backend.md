# Архітектура бекенду PoliValko

Цей документ описує цільову структуру .NET-частини (`src/`, `tests/`) після рефакторингу: модульний моноліт
з одним хостом API, одним хостом Worker, спільною платформою (`PoliValko.Infrastructure`), спільним ядром
(`PoliValko.SharedKernel`) і самодостатніми модулями. Поведінка системи (HTTP API, модель БД, фонові завдання,
інтеграції) під час рефакторингу не змінюється — див. розділ «Інваріанти».

## 1. Цільове дерево

```
src/
  PoliValko.SharedKernel/            без залежностей від інших проєктів PoliValko
    KyivTime.cs  MoneyDto.cs  PageRequest.cs  PagedResponse.cs  PhoneNumber.cs  Transliteration.cs

  PoliValko.Infrastructure/          платформа: одна БД, outbox, аудит, ідемпотентність, медіа, безпека, синхронізації
    PlatformModule.cs                AddPlatform, AddPlatformJobs, AddModelConfigurator, AddOutboxHandler
    Audit/         AuditEntry, IAuditLog, EfAuditLog, AuditEntryConfiguration
    Idempotency/   IdempotencyRecord(+Configuration), IdempotencyFilter, IdempotencyHeaders,
                   IdempotencyEndpointExtensions, IdempotencyCleanupService
    Media/         MediaOptions, StoredMedia, MediaValidationException, IMediaStorage, LocalMediaStorage, MediaEndpointExtensions
    Outbox/        IOutboxMessage, IOutboxHandler, IOutbox, EfOutbox, OutboxJson, OutboxMessage, OutboxStatus,
                   OutboxMessageConfiguration, OutboxOptions, OutboxRetryPolicy, OutboxProcessor,
                   OutboxHandlerRegistry, OutboxDispatcherService
    Persistence/   PoliValkoDbContext, IModelConfigurator, Schemas, SqlLike, Migrations/ (не змінюються)
    Security/      StaffUser, StaffRoles, StaffClaims, StaffPolicies, IdentityModel, AuthProblems,
                   CsrfFilter, CsrfHeaders, StaffEndpointExtensions
    Storefront/    SiteOptions, StorefrontOptions, IStorefrontCache, StorefrontCache, StorefrontTags
    Sync/          ScheduledJobService, ISyncJournal, SyncJournal, SyncOptions, IntegrationAlert, SyncState,
                   SyncRun, SyncRunStatus, SyncError, SyncResult, SyncStateConfiguration, SyncRunConfiguration
    Text/          IRichTextSanitizer, RichTextSanitizer
    Web/           Problems, ProblemDetailsRegistration, BadRequestExceptionHandler, QueryEnum,
                   RateLimiting (RateLimitPolicies + AddApiRateLimiting), Cors (AddApiCors)

  Modules/
    PoliValko.<Модуль>/              однаковий внутрішній устрій для всіх модулів (розділ 3)
      <Модуль>Module.cs
      Contracts/  Configuration/  Domain/  Persistence/  Features/  Integrations/  Jobs/
    PoliValko.Catalog/   PoliValko.Content/   PoliValko.Delivery/   PoliValko.Fiscal/   PoliValko.Identity/
    PoliValko.Navkolo/   PoliValko.Notifications/   PoliValko.Ordering/   PoliValko.Payments/
    PoliValko.Admin/                 новий модуль звітів і службових екранів адмінки (розділ 5)

  PoliValko.Api/                     лише композиція
    Program.cs
    Composition/  ApiServices.cs  ApiPipeline.cs  ApiEndpoints.cs  ApiDatabase.cs

  PoliValko.Worker/                  лише композиція
    Program.cs
    Composition/  WorkerServices.cs

tests/                               теки дзеркальні до модулів; простори імен тестів лишилися плоскими
                                     (PoliValko.UnitTests, PoliValko.IntegrationTests), окрім Architecture
  PoliValko.UnitTests/
    Architecture/   ModuleBoundaryTests, HostCompositionTests, PersistedIdentityTests, ModuleLayoutTests, MetadataScanner,
                    SolutionAssemblies (список збірок модулів, корінь репозиторію, шляхи до збірок хостів)
    Platform/       OutboxRetryPolicyTests
    SharedKernel/   SharedKernelTests
    Content/        ServiceRequestValidationTests
    Delivery/       DeliveryTests, NovaPoshtaClientTests
  PoliValko.IntegrationTests/
    Infrastructure/ ApiFactory (+ [AssemblyFixture] і послідовне виконання), Staff, TestJson, ProblemBody
    Catalog/        CatalogApiTests, CatalogFacetsTests, AdminCatalogApiTests, AdminProductStockApiTests
    Content/        ServiceRequestApiTests, SiteContentApiTests
    Delivery/       DeliveryApiTests
    Identity/       AuthApiTests, StaffApiTests
    Ordering/       CheckoutApiTests, AdminOrderApiTests, AdminCustomerApiTests, TestOrders
    Payments/       PaymentsApiTests
    Admin/          AdminDashboardApiTests, AdminSearchApiTests, IntegrationApiTests
```

## 2. Правила залежностей

| Хто | Може використовувати |
| --- | --- |
| `PoliValko.SharedKernel` | лише BCL |
| `PoliValko.Infrastructure` | SharedKernel, пакети ASP.NET Core / EF Core |
| Модуль `PoliValko.<M>` | SharedKernel, Infrastructure (усе), власні типи, **лише** простір імен `PoliValko.<Інший>.Contracts` інших модулів |
| `PoliValko.Admin` | так само, як будь-який модуль: лише `Contracts` інших модулів плюс платформні таблиці Infrastructure (outbox, sync, audit) |
| `PoliValko.Api`, `PoliValko.Worker` | SharedKernel, Infrastructure, клас `PoliValko.<M>.<M>Module` кожного модуля і `Contracts`; жодних запитів до БД (без `System.Linq.Queryable` і `EntityFrameworkQueryableExtensions`), жодних власних DTO |

Додатково:

- Посилання між проєктами (`ProjectReference`) лишаються такими, як зараз: Content → Notifications;
  Ordering → Catalog, Delivery, Notifications; Payments → Ordering; Fiscal → Ordering; Navkolo → Catalog, Ordering;
  Admin → Catalog, Content, Delivery, Navkolo, Ordering, Payments. Межу задає не посилання на проєкт, а простір імен
  `Contracts`, і її перевіряє архітектурний тест.
- Публічні типи в `Contracts` не відкривають внутрішніх типів модуля: у сигнатурах (властивості, параметри,
  результати, базові типи, generic-аргументи) — лише BCL/Microsoft, SharedKernel, Infrastructure та інші `Contracts`.
- `InternalsVisibleTo` дозволено лише для `PoliValko.UnitTests` і `PoliValko.IntegrationTests`.
- Спільний `PoliValkoDbContext` лишається одним (одна транзакція для бізнес-змін і outbox). Модуль звертається через
  `db.Set<T>()` лише до власних сутностей і до платформних (`OutboxMessages`, `SyncState`, `SyncRun`, `AuditEntry`,
  `IdempotencyRecord`). Дані іншого модуля — тільки через інтерфейс з його `Contracts`.

### Як модулі говорять між собою

1. **Порти в `Contracts`** — інтерфейси, які реалізує модуль-власник і реєструє як scoped. Реалізація працює з тим
   самим scoped `PoliValkoDbContext`, що й викликач, і **не викликає `SaveChangesAsync`**, якщо це не сказано явно:
   зміни зберігає викликач однією транзакцією, як і раніше. Метод порту містить той самий LINQ-запит, що був
   у викликача, тож SQL і кількість звернень до БД не змінюються. Для змін уже завантаженого агрегату реалізація бере
   його з трекера через `FindAsync` (без додаткового запиту).
2. **Повідомлення outbox** (`IOutboxMessage`) — у `Contracts` модуля, що їх публікує; обробники — у `Features`
   модуля-споживача. Диспетчеризація йде за рядком `Type`, а не за іменем CLR-типу.
3. **Константи й «опубліковані» перелічення** (статуси, способи оплати, назви завдань) — у `Contracts` власника.

Карта контрактів:

| Модуль | `Contracts` |
| --- | --- |
| Catalog | `ICatalogPricing` + `ProductPricing`; `ICatalogFreshness`; `ICatalogImporter` + `NavkoloProductRecord`, `PriceStockRecord`, `CatalogImportResult`; `ProductAttributeDto`; `ICatalogDemoFeed` (джерело демо-записів для заглушки Navkolo); `ICatalogReporting` (картки товарів, товари, що закінчуються, пошук товарів для адмінки) |
| Content | `ServiceRequestSubmitted`; `IServiceRequestStats` (кількість нових заявок) |
| Delivery | `IDeliveryDirectory`, `Settlement`, `Warehouse`, `WarehouseType`, `PickupPoint`; `DeliveryJobs.NovaPoshtaDirectory` |
| Navkolo | `NavkoloJobs`; `ImportRunDto` (+ `ImportRunDto.From(SyncRun)`); `INavkoloSettings` (режим інтеграції) |
| Notifications | `IManagerNotifier`, `ManagerNotification` |
| Ordering | повідомлення `OrderPlaced`, `PaymentSucceeded`, `OrderExportRequested`, `FiscalReceiptRequested` + `FiscalTrigger`, `RefundRequested`; перелічення `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `DeliveryMethod`, `RefundMethod`, `RefundStatus`; `DeliveryCodes`, `PaymentCodes`, `OrderProblems`; `OrderStatusCountDto` + `OrderStatusCounts`; порти `IOrderPayments` (Payments), `IOrderReceiptSource` (Fiscal), `IOrderExportSource` (Navkolo), `IOrderReporting` (Admin) і їхні записи-знімки (`PayableOrder`, `OrderPaymentTarget`, `PaidOrderResult`, `RefundToProcess`, `OrderForReceipt`, `OrderForExport`, `OrderPeriodRow`, `ProductSalesRow`, `OrderedProductSnapshot`, `OrderSearchHit`, `CustomerSearchHit`); `SellerOptions` — у `Configuration` |
| Payments | `PaymentJobs.Reconcile` |
| Fiscal, Identity, Admin | порожньо (нікому не потрібні) |

## 3. Устрій модуля

```
PoliValko.<M>/
  <M>Module.cs          єдина точка входу (public static class), простір імен PoliValko.<M>
  Contracts/            публічна поверхня для інших модулів і хостів
  Configuration/        класи налаштувань, що зв'язуються з appsettings (<M>Options, ...)
  Domain/               сутності, перелічення, доменні правила (переходи статусів, токени тощо)
  Persistence/          <M>ModelConfigurator, сідери, вбудовані дані, спільні запити завантаження агрегату
  Features/<Область>[/<Підобласть>]/
                        вертикальні зрізи: мапінг маршрутів, обробник, контракти запиту/відповіді, валідація
  Integrations/<Система>/
                        зовнішні клієнти, провайдери й заглушки за інтерфейсами
  Jobs/                 нащадки ScheduledJobService (лише для Worker)
```

Правила:

- Простір імен = шлях теки (`Features/Admin/Products/UpdateProduct.cs` → `PoliValko.Catalog.Features.Admin.Products`).
  У корені `PoliValko.<M>` — лише клас `<M>Module`. Інші простори імен другого рівня — тільки
  `Contracts`, `Configuration`, `Domain`, `Persistence`, `Features`, `Integrations`, `Jobs`.
- Один файл — один публічний або внутрішній тип верхнього рівня (вкладені приватні записи — разом із власником).
  Виняток: файл `<Область>Dtos.cs` збирає записи запитів/відповідей області, що використовуються кількома зрізами.
- **Зріз (use case)** — `internal static class <ДіяСутність>` з методом `HandleAsync(...)`; поруч — його приватні
  проєкції й валідація. Записи запиту/відповіді, які бачить лише цей зріз, — у тому ж файлі.
- **Мапінг області** — `internal static class <Область>Endpoints` з методом `Map(...)`. Ланцюжок
  `MapGroup/Map*/WithTags/WithName/WithSummary/Produces*/Require*/DisableAntiforgery/RequireIdempotency`
  переноситься дослівно; змінюється лише посилання на обробник (`ListProductsAsync` → `ListProducts.HandleAsync`).
- Обробники повідомлень outbox — `Features/<Область>/<Дія>On<Подія>.cs` (`IOutboxHandler<T>`), реалізації портів
  інших модулів — `Features/<Область>/<Назва>.cs` (наприклад, `Features/Reporting/OrderReporting.cs`).
- DTO, що потрапляють в OpenAPI, лишаються `public sealed record` з тими самими іменами, порядком і типами властивостей.
  Решта — `internal`.
- Нових коментарів у коді не пишемо: пояснення живуть у цьому документі та в `docs/`.

Уточнення, що з'явилися під час розкладання Catalog, Ordering і Payments на зрізи:

- Синхронний обробник називається `Handle` (наприклад, `GetSeller.Handle` замість лямбди в ланцюжку `/seller`):
  тип результату (`Ok<SellerDto>`) і параметри ті самі, тож документ OpenAPI не змінюється.
- Допоміжний клас області — `internal static class`, названий за призначенням (`ProductListing`, `CategoryQueries`,
  `OrderMapping`, `RedirectWriter`). Якщо таке ім'я збіглося б з DTO того самого простору імен, клас дістає інше:
  фасети пошуку будує `ProductFacetBuilder`, бо `ProductFacets` — схема OpenAPI.
- Велика адмін-область ділиться на підобласті з власним `<Підобласть>Endpoints.Map(group)`. Батьківський
  `AdminCatalogEndpoints.Map` створює спільну групу `/catalog` і викликає підобласті в порядку документа OpenAPI:
  товари, назви характеристик, розділи, добірки, перенаправлення.
- Службові записи, які бачить лише один клас, вкладаються в нього (`CheckoutCalculator.PricedLine`,
  `OrderValidator.ValidatedOrder`, `ProductListing.ListItemRow`, `OrderCsv.Row`), щоб у файлі лишався один тип
  верхнього рівня. DTO-схеми OpenAPI, які потрібні одному зрізу, лежать в окремому файлі (`AttributeNameDto.cs`,
  `AdminPaymentDto.cs`), а не всередині класу зрізу: вкладеність впливає на ім'я схеми (розділ 6.1).
- Категорії логерів, що створюються через `ILoggerFactory`, беруть клас зрізу (`StartPayment`, `ReceiveWebhook`).

### Розкладка Catalog, Ordering, Payments

```
PoliValko.Catalog/
  CatalogModule.cs  Contracts/  Configuration/CatalogOptions
  Domain/                  Category, HomeCollection, UrlRedirect, Product, ProductPrice, ProductStock, ProductImage,
                           ProductAttribute, TopLevelCategories
  Persistence/             CatalogModelConfigurator, CatalogDemoData, demo-catalog.json
  Features/Storefront/     CatalogEndpoints; GetCategoryTree, GetCategory, SearchProducts, GetProduct, GetPhotoCredits,
                           GetCollections, GetSitemap, ResolveRedirect; StorefrontDtos (+ ProductSearchQuery, ProductSort);
                           ProductFacetBuilder, ProductListing, CategoryQueries
  Features/Admin/          AdminCatalogEndpoints (група /catalog), CatalogAdminValidation
    Products/              ProductEndpoints; ListProducts, SetProductsVisibility, GetAdminProduct, UpdateProduct,
                           UploadProductImage, UpdateProductImages, DeleteProductImage; AdminProductDtos,
                           AdminProductQueries, ProductStockFilters
    AttributeNames/        AttributeNameEndpoints, ListAttributeNames, AttributeNameDto
    Categories/            CategoryEndpoints; ListCategories, CreateCategory, UpdateCategory, DeleteCategory;
                           CategoryEditor (зокрема ToDto), AdminCategoryDtos
    Collections/           CollectionEndpoints; ListCollections, CreateCollection, UpdateCollection, DeleteCollection;
                           CollectionEditor (зокрема ToDto), AdminCollectionDtos
    Redirects/             RedirectEndpoints; ListRedirects, CreateRedirect, DeleteRedirect; RedirectWriter,
                           AdminRedirectDtos
  Features/Import/         CatalogImporter (ICatalogImporter), ImportValidation, ProductFieldWriter, ImportText,
                           CatalogDemoFeed (ICatalogDemoFeed: записи демо-каталогу у форматі Navkolo)
  Features/Pricing/        CatalogPricing (ICatalogPricing), AlwaysFreshCatalog (ICatalogFreshness)
  Features/Reporting/      CatalogReporting (ICatalogReporting)

PoliValko.Ordering/
  OrderingModule.cs  Contracts/  Configuration/SellerOptions
  Domain/                  Order, OrderItem, OrderStatusChange, OrderRefund, OrderRefundLine, OrderTokens, OrderTransitions,
                           OrderActors (хто змінив статус: «Покупець», «Платіжна система»)
  Persistence/             OrderingModelConfigurator, OrderLoader (агрегат з позиціями, історією й поверненнями)
  Features/Checkout/       CheckoutEndpoints; QuoteCheckout, CreateOrder, GetOrder, GetSeller; CheckoutCalculator,
                           OrderValidator, OrderMapping (CanPay — і для IOrderPayments), CheckoutDtos (+ QuoteIssues)
  Features/Admin/Orders/   AdminOrderEndpoints; ListOrders, CountOrders, ExportOrders, GetAdminOrder, ChangeOrderStatus,
                           CreateRefund; AdminOrderDtos, AdminOrderMapping, AdminOrderFilter, AdminOrderSorts,
                           OrderSearch, OrderCsv
  Features/Admin/Customers/ AdminCustomerEndpoints; ListCustomers; CustomerContacts; AdminCustomerDtos
  Features/Notifications/  NotifyManagerOnOrderPlaced, NotifyManagerOnPaymentSucceeded, OrderMoney
  Features/PaymentState/   OrderPayments          Features/Receipts/   OrderReceiptSource
  Features/Export/         OrderExportSource      Features/Reporting/  OrderReporting

PoliValko.Payments/
  PaymentsModule.cs  Contracts/PaymentJobs  Configuration/ PaymentsOptions, SandboxOptions, MonoOptions
  Domain/                  PaymentAttemptStatus, Payment, PaymentEvent, SandboxInvoice
  Persistence/             PaymentsModelConfigurator
  Integrations/Providers/  IPaymentProvider, IPaymentProviders, PaymentProviders, PaymentProviderNames,
                           PaymentBasketItem, InvoiceRequest, CreatedInvoice, ProviderPaymentState,
                           ProviderPaymentStatus, ProviderRefundResult, PaymentWebhookRejectedException
  Integrations/Mono/       MonoPaymentProvider (записи формату monobank вкладені)
  Integrations/Sandbox/    SandboxPaymentProvider
  Features/Checkout/       PaymentEndpoints; StartPayment, ReceiveWebhook, GetSandboxInvoice, CompleteSandboxPayment;
                           PaymentDtos
  Features/Admin/          AdminPaymentEndpoints, ListOrderPayments, AdminPaymentDto
  Features/Processing/     PaymentProcessor, PaymentUpdateResult
  Features/Refunds/        ProcessRefundRequested
  Jobs/                    PaymentReconciliationJob
```

Уточнення, що з'явилися під час розкладання Content, Delivery, Fiscal, Identity, Navkolo, Notifications:

- Зріз створення заявки на послугу називається `SubmitServiceRequest` (з `HandleAsync` і `Validate`), бо
  `CreateServiceRequest` — схема OpenAPI (тіло запиту) в тому самому просторі імен. Юніт-тест перевіряє
  `SubmitServiceRequest.Validate`.
- Лямбди з ланцюжків (`/service-directions`, `/content/pages`, обидва `/orders/{number}/receipts`, `/auth/csrf`) стали
  методами зрізів з тими самими параметрами (зокрема `[FromServices]`) і тим самим типом результату; синхронні
  обробники називаються `Handle` (`Me.Handle`, `GetCsrfToken.Handle`).
- Константи, що належали класу мапінгу, переїхали до зрізу, який їх використовує: `UpdatePickupPoint.PickupPointUpdatedAction`,
  `GetNovaPoshtaStatus.DemoMode` / `ApiMode`, `ImportCatalogFile.MaxFileBytes`. Знімок полів точки самовивозу
  вкладено в зріз (`UpdatePickupPoint.PickupPointValues`): він не є схемою OpenAPI, а JSON запису аудиту не змінився.
- Спільні для кількох зрізів області `ToDto` і типова проблема «не знайдено» живуть у класі мапінгу області:
  `SiteContentMapping` (+ `Clean`, `PageNotFound`), `AdminServiceRequestMapping`, `AdminPickupPointMapping`,
  `StaffMapping` (+ `UserNotFound`); спільні перевірки працівників — `StaffValidation`, спільний запит чеків —
  `ReceiptQueries`. Допоміжне, потрібне одному зрізу, лишилося приватним у ньому (`SaveContacts.Check`/`CheckUrl` і
  `[GeneratedRegex]` у `partial`-класі зрізу, `ResetStaffPassword.ValidatePasswordAsync`, `Login.InvalidCredentials`).
- Клієнт Нової пошти поділено на транспорт (`NovaPoshtaClient`: сторінки, виклик, повтори, `Retry-After`), розбір
  відповіді (`NovaPoshtaResponseParser`) і мапінг записів (`NovaPoshtaMapper`). Мапер читає поля через
  `NovaPoshtaResponseParser.Text` (`using static`), тож тіла методів не змінилися. `NovaPoshtaRequest` із приватного
  вкладеного запису став `internal` записом верхнього рівня — тіло запиту (`apiKey`, `modelName`, `calledMethod`,
  `methodProperties`) те саме.
- `CatalogFileParser.ParseAsync(stream, fileName, ct)` так само обирає CSV чи JSON за розширенням файлу; перехоплення
  `JsonException` / `FormatException` і текст помилки лишилися в `ImportCatalogFile`.
- У Fiscal, як і в Payments, інтерфейс провайдера ПРРО та його записи лежать в `Integrations/Providers/`, реалізації —
  в `Integrations/Stub` і `Integrations/Checkbox`. Обробники `ExportOrderToNavkolo`, `IssueReceiptOnRequest` і `ProcessRefundRequested` зберегли свої
  імена, хоч і не мають форми `<Дія>On<Подія>` (класи не перейменовуємо).

### Розкладка Content, Delivery, Fiscal, Identity, Navkolo, Notifications

```
PoliValko.Content/
  ContentModule.cs  Contracts/ ServiceRequestSubmitted, IServiceRequestStats
  Domain/                  ServiceRequest, ServiceRequestStatus, ServiceDirection, ServiceDirections, ContentPage,
                           SiteContacts, ServiceDirectionContent
  Persistence/             ContentModelConfigurator
  Features/ServiceRequests/ ServiceRequestEndpoints; GetServiceDirections, SubmitServiceRequest (+ Validate);
                           ServiceRequestDtos; NotifyManagerOnServiceRequest; ServiceRequestStats (IServiceRequestStats)
    Admin/                 AdminServiceRequestEndpoints; ListServiceRequests, ChangeServiceRequestStatus;
                           AdminServiceRequestDtos, AdminServiceRequestMapping
  Features/SiteContent/    SiteContentEndpoints (pages, contacts), AdminSiteContentEndpoints (група /content);
                           GetPage, GetContacts, ListPages, SavePage, SaveContacts, ListServiceDirections,
                           SaveServiceDirection; SiteContentDtos, SiteContentMapping

PoliValko.Delivery/
  DeliveryModule.cs  Contracts/  Configuration/NovaPoshtaOptions
  Domain/                  NpSettlement, NpWarehouse, PickupLocation, DeliveryLimits
  Persistence/             DeliveryModelConfigurator
  Integrations/NovaPoshta/ NovaPoshtaClient, NovaPoshtaResponseParser, NovaPoshtaMapper, NovaPoshtaException,
                           NovaPoshtaArea, NovaPoshtaPage<T>, NovaPoshtaRequest, NovaPoshtaText
  Features/Directory/      DemoNovaPoshtaDirectory, NovaPoshtaDbDirectory (IDeliveryDirectory), PickupPointStore
  Features/Storefront/     DeliveryEndpoints; SearchSettlements, GetWarehouses, GetPickupPoints; DeliveryDtos
  Features/Admin/          AdminDeliveryEndpoints; ListPickupPoints, UpdatePickupPoint (+ Validate, PickupPointValues),
                           GetNovaPoshtaStatus; AdminDeliveryDtos, AdminPickupPointMapping
  Features/DirectorySync/  NovaPoshtaDirectorySync (+ RecountActiveWarehousesSql)
  Jobs/                    NovaPoshtaSyncJob

PoliValko.Fiscal/
  FiscalModule.cs  Configuration/ FiscalOptions, CheckboxOptions
  Domain/                  Receipt, ReceiptKind, ReceiptStatus, ReceiptMoment
  Persistence/             FiscalModelConfigurator
  Integrations/Providers/  IFiscalProvider, ReceiptGood, ReceiptDraft, IssuedReceipt
  Integrations/Stub/       StubFiscalProvider
  Integrations/Checkbox/   CheckboxFiscalProvider (записи формату Checkbox вкладені)
  Features/Receipts/       ReceiptEndpoints; GetOrderReceipts, ListOrderReceipts; ReceiptQueries, ReceiptDto
  Features/Issuing/        IssueReceiptOnRequest

PoliValko.Identity/
  IdentityModule.cs
  Persistence/             IdentitySeeder
  Features/Auth/           AuthEndpoints; Login, Logout, Me, GetCsrfToken; AuthDtos; StaffClaimsFactory
  Features/Staff/          StaffEndpoints (група /users, потім /auth/password); ListStaffUsers, CreateStaffUser,
                           UpdateStaffUser, LockStaffUser, ResetStaffPassword, ChangeOwnPassword; StaffDtos,
                           StaffValidation, StaffMapping

PoliValko.Navkolo/
  NavkoloModule.cs  Contracts/  Configuration/ NavkoloOptions, StubOptions, NavkoloModes
  Integrations/NavkoloApi/ INavkoloClient, NavkoloOrder, NavkoloOrderLine, NavkoloUnavailableException, StubNavkoloClient
  Features/CatalogImport/  CatalogImportEndpoints; ImportCatalogFile; CatalogFileParser (CSV і JSON)
  Features/Freshness/      NavkoloFreshness (ICatalogFreshness)
  Features/OrderExport/    ExportOrderToNavkolo
  Features/Settings/       NavkoloSettings (INavkoloSettings)
  Jobs/                    NavkoloPriceStockJob, NavkoloCatalogJob

PoliValko.Notifications/
  NotificationsModule.cs  Contracts/ IManagerNotifier, ManagerNotification  Configuration/TelegramOptions
  Integrations/Telegram/   TelegramManagerNotifier
  Integrations/Log/        LogManagerNotifier
  Features/IntegrationAlerts/ NotifyResponsibleOnIntegrationAlert
```

### Точка входу `<M>Module`

```csharp
public static class CatalogModule
{
    public static IServiceCollection AddCatalogModule(this IServiceCollection services, IConfiguration configuration);
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder api);
    public static RouteGroupBuilder MapAdminCatalogEndpoints(this RouteGroupBuilder admin);
    public static Task SeedDemoDataAsync(IServiceProvider services, CancellationToken ct = default);
}
```

- `Add<M>Module(IServiceCollection, IConfiguration)` — у кожного модуля однакова сигнатура (параметр
  `configuration` може не використовуватися). Реєструє налаштування, `IModelConfigurator`, сервіси, порти,
  обробники outbox і заглушки інтеграцій.
- `Add<M>Jobs(IServiceCollection)` — лише якщо в модуля є фонові завдання; викликає тільки Worker.
- `Map<Область>Endpoints(this IEndpointRouteBuilder api)` — публічний API області;
  `MapAdmin<Область>Endpoints(this RouteGroupBuilder admin)` — адмінка області. Одна функція на кожен блок, який
  у документі OpenAPI стоїть окремо (див. порядок у розділі 4), тож хост задає порядок, а модуль — вміст.
- Сідери, які запускає хост: `CatalogModule.SeedDemoDataAsync`, `IdentityModule.SeedUsersAsync`.

## 4. Хости

### API (`src/PoliValko.Api`)

`Program.cs` лише викликає композицію:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddPoliValkoApi(builder.Configuration);
var app = builder.Build();
app.UsePoliValkoPipeline();
app.MapPoliValkoEndpoints();
await app.PrepareDatabaseAsync();
await app.RunAsync();

public partial class Program;
```

- `ApiServices.AddPoliValkoApi` — у незмінному порядку: `AddPlatform()`, модулі Catalog, Content, Delivery, Ordering,
  Payments, Fiscal, Navkolo, Identity, Notifications, Admin; далі `AddApiProblemDetails`, `AddApiRateLimiting`,
  `AddApiCors`, `ConfigureHttpJsonOptions` (NumberHandling.Strict, JsonStringEnumConverter camelCase), `AddOpenApi("v1", …)`
  з тим самим описом документа, `AddHealthChecks().AddDbContextCheck<PoliValkoDbContext>("database", tags: ["ready"])`.
- `ApiPipeline.UsePoliValkoPipeline` — `UseExceptionHandler`, `UseStatusCodePages`, `UseCors`, `UseMediaFiles`,
  `UseAuthentication`, `UseAuthorization`, `UseRateLimiter`.
- `ApiEndpoints.MapPoliValkoEndpoints` — документація (`/api/openapi/{documentName}.json`, `/api/docs`) за тієї ж умови,
  потім маршрути в **канонічному порядку**, потім `/health/live` і `/health/ready`:

```
/api/v1:   Catalog.MapCatalogEndpoints
           Content.MapServiceRequestEndpoints        (service-directions, service-requests)
           Content.MapSiteContentEndpoints           (pages, contacts)
           Delivery.MapDeliveryEndpoints
           Ordering.MapCheckoutEndpoints             (checkout/quote, orders, orders/{number}, seller)
           Payments.MapPaymentEndpoints
           Fiscal.MapReceiptEndpoints                (orders/{number}/receipts)
/admin:    Identity.MapAdminAuthEndpoints
           Identity.MapAdminStaffEndpoints           (users..., auth/password)
           Admin.MapAdminSummaryEndpoints
           Admin.MapAdminDashboardEndpoints
           Admin.MapAdminSearchEndpoints
           Ordering.MapAdminOrderEndpoints
           Ordering.MapAdminCustomerEndpoints
           Payments.MapAdminPaymentEndpoints
           Fiscal.MapAdminReceiptEndpoints
           Catalog.MapAdminCatalogEndpoints
           Content.MapAdminSiteContentEndpoints
           Navkolo.MapAdminCatalogImportEndpoints    (integration/navkolo/import)
           Admin.MapAdminIntegrationEndpoints        (integration/status, runs, jobs, outbox, audit)
           Content.MapAdminServiceRequestEndpoints
           Delivery.MapAdminDeliveryEndpoints
```

Цей порядок визначає порядок шляхів у `openapi/polivalko-api.json`; змінювати його не можна.

- `ApiDatabase.PrepareDatabaseAsync` — та сама логіка `Database:ApplyMigrationsOnStartup`, `Database:SeedDemoData`,
  `Seed:Users`: міграція, перевірка незастосованих міграцій, `CatalogModule.SeedDemoDataAsync`,
  `IdentityModule.SeedUsersAsync`.

### Worker (`src/PoliValko.Worker`)

`WorkerServices.AddPoliValkoWorker(configuration)`: `AddPlatform()`, модулі Catalog, Content, Delivery, Ordering,
Payments, Fiscal, Navkolo, Notifications (без Identity й Admin), потім `AddPlatformJobs()`, `AddDeliveryJobs()`,
`AddPaymentsJobs()`, `AddNavkoloJobs()` — порядок реєстрації hosted services не змінюється.

## 5. Модуль Admin

`src/Modules/PoliValko.Admin` забирає з хоста `AdminDashboard.cs`, `AdminSearch.cs`, `AdminSummary.cs`,
`IntegrationAdmin.cs`. Він — звичайний модуль: читає інші модулі лише через порти з їхніх `Contracts`
(`IOrderReporting`, `ICatalogReporting`, `IServiceRequestStats`, `ICatalogFreshness`, `INavkoloSettings`) і напряму —
лише платформні таблиці Infrastructure (outbox, стан і журнал синхронізацій, аудит).

Чому порти, а не «спільний read-only доступ до чужих сутностей»: кожен запит зведення й так був окремим зверненням до
БД (замовлення, товари, позиції, залишки), тож перенесення запиту в метод порту власника дає той самий SQL,
а схема таблиць модуля лишається його внутрішньою справою.

```
PoliValko.Admin/
  AdminModule.cs                AddAdminModule, MapAdminSummaryEndpoints, MapAdminDashboardEndpoints,
                                MapAdminSearchEndpoints, MapAdminIntegrationEndpoints
  Features/Summary/             GetAdminSummary, AdminSummaryDto
  Features/Dashboard/           GetAdminDashboard, DashboardDtos (AdminDashboardDto, DashboardTotalsDto, ...)
  Features/Search/              SearchAdmin, SearchDtos (AdminSearchDto, SearchOrderHitDto, ...)
  Features/Integration/         IntegrationEndpoints (status, runs, jobs/{job}/run, outbox, outbox/{id}/retry, audit),
                                GetIntegrationStatus, ListSyncRuns, RequestJobRun, ListOutbox, RetryOutboxMessage,
                                SyncJobTitles, IntegrationDtos
  Features/Audit/               ListAudit, AuditDtos (AuditEntryDto, AuditQuery)
```

Блоки `summary`, `dashboard` і `search` мають по одному маршруту, тож їхні ланцюжки мапінгу стоять просто в
`AdminModule`; блок інтеграцій (разом з `audit`) мапить `IntegrationEndpoints.Map`. Обробники отримують порти через
`[FromServices]`, у документі OpenAPI вони не з’являються.

`SyncJobTitles` зберігає той самий порядок ключів (`navkolo.price-stock`, `navkolo.catalog`, `navkolo.import`,
`novaposhta.directory`, `payments.reconcile`) — від нього залежить порядок завдань у відповіді `integration/status`.

## 6. Інваріанти

### 6.1 OpenAPI — байт у байт

- Документ генерує `Microsoft.Extensions.ApiDescription.Server` під час збірки `PoliValko.Api` у
  `openapi/polivalko-api.json`. Перевірка: `git diff --exit-code -- openapi/` порожній. Руками не редагувати.
- Порядок шляхів = порядок мапінгу (розділ 4) і порядок `Map*` усередині груп.
- Імена схем = короткі імена CLR-типів (`AdminDashboardDto`, `PagedResponseOfAuditEntryDto`, `SyncError`, ...).
  Простір імен і збірка типу на документ не впливають, але **ім'я, generic-форма й вкладеність** — впливають.
  Порядок властивостей у схемі = порядок параметрів записів.
- Метадані операцій: `WithName`, `WithSummary`, `WithTags`, порядок і набір `ProducesProblem`, `RequireStaff` (додає 401/403),
  `RequireIdempotency<T>` (заголовок `Idempotency-Key`), `WithEnumQuery<T>` (посилання на схему за `typeof(T).Name`),
  `[AsParameters]`-записи з `[FromQuery(Name=…)]` і `[Description]`, імена, порядок, типи й nullability параметрів
  обробників, generic-аргументи `Results<…>` у тому самому порядку.
- `GenerateDocumentationFile=false` у `Directory.Build.props`: XML-коментарі в документ не потрапляють, тож їх
  видалення OpenAPI не змінює. Цю властивість не вмикати.

### 6.2 Модель EF Core — без нової міграції

- Один `PoliValkoDbContext` (`IdentityDbContext<StaffUser, IdentityRole, string>`) і міграції в
  `src/PoliValko.Infrastructure/Persistence/Migrations` (`Initial`, `Prototype`, `LaunchScope` і snapshot) —
  файли міграцій не чіпати.
- Модель: `IdentityModel.MoveToSchema`, розширення `pg_trgm`, `ApplyConfigurationsFromAssembly` збірки
  Infrastructure (конфігурації outbox, idempotency, audit, sync лишаються в цій збірці), потім `IModelConfigurator`
  у порядку реєстрації (Catalog, Content, Delivery, Ordering, Payments, Fiscal), `UseSnakeCaseNamingConvention`,
  таблиця історії `integration.__ef_migrations_history`, схеми з `Schemas`.
- Не перейменовувати класи сутностей і їхні властивості (імена таблиць, колонок, ключів і індексів беруться з них),
  не змінювати `HasData(TopLevelCategories.All)`. Перенесення сутності в інший простір імен модель не змінює —
  перевіряє гейт.
- Перевірка (зверніть увагу: у `dotnet ef` ключ `-c` означає `--context`, тому конфігурацію задаємо повністю):
  `dotnet tool restore` і
  `dotnet ef migrations has-pending-model-changes --project src/PoliValko.Infrastructure --startup-project src/PoliValko.Api --configuration Release --no-build`
  → «No changes have been made to the model since the last migration.»

### 6.3 Збережені ідентичності

- **Outbox**: колонка `type` = статичний рядок `IOutboxMessage.Type`, не ім'я CLR-типу:
  `ordering.order-placed`, `ordering.payment-succeeded`, `ordering.export-requested`,
  `ordering.fiscal-receipt-requested`, `ordering.refund-requested`, `content.service-request-submitted`,
  `integration.alert`. Payload — `System.Text.Json` з `JsonSerializerDefaults.Web`: імена властивостей записів
  (camelCase) і числові значення `FiscalTrigger` (`Payment=0`, `Completion=1`, `Refund=2`) не змінюються.
  CLR-простір імен повідомлень змінювати можна.
- **Завдання синхронізації** (`sync_states.job`, `sync_runs.job`): `navkolo.price-stock`, `navkolo.catalog`,
  `navkolo.import`, `novaposhta.directory`, `payments.reconcile`; виконавці `Розклад`, `Запит з адмінки`.
- **Перелічення, що зберігаються рядком** (`HasConversion<string>()`) або видні в OpenAPI: імена членів
  `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `DeliveryMethod`, `RefundMethod`, `RefundStatus`,
  `PaymentAttemptStatus`, `ReceiptKind`, `ReceiptStatus`, `WarehouseType`, `OutboxStatus`, `SyncRunStatus`,
  `ServiceRequestStatus`; `payment_events.state` = `ProviderPaymentState.ToString()`.
- Рядкові літерали дій і типів аудиту (`order.status_changed`, `integration.outbox_retried`, `SyncJob`, `CatalogImport`, …),
  коди проблем (`catalog.product_not_found`, …), тексти помилок валідації.
- `idempotency_keys.scope` = `"{METHOD} {шаблон маршруту}"` — шаблони маршрутів і префікси груп не змінюються.
- Data Protection: `SetApplicationName("PoliValko")`, ключі в `identity.data_protection_keys`; cookie `pv_admin`,
  `pv_csrf`; заголовок `X-CSRF-TOKEN`.
- Вбудований ресурс `demo-catalog.json` шукається за суфіксом імені; якщо файл переїжджає, шлях у
  `<EmbeddedResource>` у `PoliValko.Catalog.csproj` переїжджає разом із ним.
- Ключ кешу `delivery:pickup-points:active`, теги ревалідації вітрини (`StorefrontTags`), структура URL медіа.
- Імена типізованих HttpClient = короткі імена класів (`NovaPoshtaClient`, `MonoPaymentProvider`,
  `CheckboxFiscalProvider`, `IManagerNotifier`, `IStorefrontCache`) — ці класи не перейменовуються.
- Категорії логерів (повне ім'я типу) змінюються разом із просторами імен — це прийнятно: жодне налаштування на них
  не спирається.

### 6.4 Налаштування

Секції, ключі й спосіб зв'язування не змінюються (умовні реєстрації читають секцію під час реєстрації, решта —
через `IOptions`):

`ConnectionStrings:PoliValko`; `Outbox` (BatchSize, MaxAttempts, LockDuration, PollInterval); `Sync`
(AlertAfterFailures); `Media` (Root, PublicPath, MaxUploadBytes); `Site:PublicUrl`; `Web` (RevalidateUrl,
RevalidateSecret); `Catalog:HiddenNavkoloGroups`; `Seller` (Name, TaxId, Address); `Delivery:NovaPoshta` (ApiKey,
BaseUrl, SyncInterval, PageSize, PageDelay, MaxRetries, RetryDelay, Timeout); `Payments` (Provider, InvoiceValidity,
Sandbox:Secret, Mono:BaseUrl, Mono:Token); `Fiscal` (Provider, IssueOn, PaymentTypes, Checkbox:*); `Navkolo`
(Mode, SyncInterval, CatalogInterval, FreshnessThreshold, Stub:SimulateOutage); `Notifications:Telegram` (BotToken,
ChatId); `RateLimiting:{Forms,Orders,Login}:{PermitLimit,WindowSeconds}` (типово 5/60, 10/600, 10/60);
`Cors:Origins`; `Api:ExposeDocs`; `Database:ApplyMigrationsOnStartup`, `Database:SeedDemoData`; `Seed:Users`.

### 6.5 HTTP-політики

- Авторизація: політики `staff` (ролі Admin, Manager) і `admin` (Admin); cookie Identity (HttpOnly, SameSite=Strict,
  8 год, sliding), блокування після 5 спроб на 15 хв, пароль від 10 символів, перевірка security stamp щохвилини,
  відповіді 401/403 у форматі Problem Details.
- Rate limiting: політики `forms`, `orders`, `login` (фіксоване вікно на IP), 429 із `Retry-After` і Problem Details
  «Забагато запитів». Імена політик — `RateLimitPolicies` в Infrastructure.
- CORS: типова політика з `Cors:Origins` з credentials; Problem Details з `code` і `traceId`, `ThrowOnBadRequest`.
- Маршрути, статус-коди, коди помилок і тексти повідомлень — без змін.

### 6.6 Фонові процеси Worker

Порядок і розклад: `OutboxDispatcherService` (опитування `Outbox:PollInterval`, 2 с), `IdempotencyCleanupService`
(щогодини, зберігання 72 год), `NovaPoshtaSyncJob` (`Delivery:NovaPoshta:SyncInterval`, типово 1 доба; лише з ApiKey),
`PaymentReconciliationJob` (2 хв; лише з активним провайдером), `NavkoloPriceStockJob` (`Navkolo:SyncInterval`,
повтор через 1 хв), `NavkoloCatalogJob` (`Navkolo:CatalogInterval`, 1 доба). `ScheduledJobService`: опитування 15 с,
повтор після збою — `min(інтервал, 15 хв)`, сповіщення після `Sync:AlertAfterFailures` збоїв.

### 6.7 Інтеграції й заглушки

- `Navkolo:Mode` = `Disabled` | `Stub`: `StubNavkoloClient` реєструється завжди; при ввімкненому режимі
  `NavkoloFreshness` замінює `AlwaysFreshCatalog`.
- `Payments:Provider` = порожньо | `Sandbox` | `Mono`; маршрути пісочниці працюють лише з `Sandbox`.
- `Fiscal:Provider` = `Disabled` | `Stub` | `Checkbox`.
- Нова пошта: без `Delivery:NovaPoshta:ApiKey` — `DemoNovaPoshtaDirectory`, з ключем — `NovaPoshtaDbDirectory`
  (вибір під час створення scoped-сервісу).
- Повідомлення: Telegram, якщо задано BotToken і ChatId, інакше лог.

## 7. Архітектурні тести

`tests/PoliValko.UnitTests/Architecture` (без нових пакетів):

- **MetadataScanner** читає збірку через `System.Reflection.Metadata` (`PEReader` + `MetadataReader`) і повертає всі
  `TypeReference` з їхньою збіркою й простором імен — зокрема ті, що використовуються лише в тілах методів.
- **ModuleBoundaryTests**: для кожного модуля (список модулів звіряється з теками `src/Modules/*`) кожне посилання на
  тип іншого модуля — лише в `PoliValko.<Інший>.Contracts`; жодних посилань на `PoliValko.Api`/`PoliValko.Worker`;
  Infrastructure і SharedKernel не посилаються на модулі; публічні сигнатури типів `Contracts` не відкривають
  внутрішніх типів; `InternalsVisibleTo` — лише тестові збірки.
- **HostCompositionTests**: хости посилаються на модулі лише через `<M>Module` і `Contracts`; не використовують
  `System.Linq.Queryable` і `EntityFrameworkQueryableExtensions`; усі типи хоста з простором імен `PoliValko.*`,
  лежать лише в `PoliValko.Api.Composition` / `PoliValko.Worker.Composition` (`Program` з top-level statements —
  у глобальному просторі імен, тож не враховується; за домовленістю типи композиції — статичні класи).
  Шляхи до збірок хостів тест отримує з `AssemblyMetadata`, які задає `PoliValko.UnitTests.csproj`
  (`ProjectReference` на хости з `ReferenceOutputAssembly="false"` гарантує порядок збірки, а `Private="false"` не дає SDK
  копіювати в теку тестів apphost, `deps.json` і `runtimeconfig.json` хостів).
- **PersistedIdentityTests**: фіксують рядки `Type` усіх `IOutboxMessage` і імена властивостей їхніх payload,
  значення `FiscalTrigger`, назви завдань синхронізації.
- **ModuleLayoutTests** (усі десять модулів, через рефлексію; типи, які згенерував компілятор, — імена з `<`,
  `[CompilerGenerated]`, допоміжні типи `[GeneratedRegex]` у `System.Text.RegularExpressions.Generated` — не враховуються):
  у корені простору імен модуля лише `public static class <M>Module`; решта типів `PoliValko.*` — у
  `PoliValko.<M>.{Contracts|Configuration|Domain|Persistence|Features|Integrations|Jobs}[.*]`; у `<M>Module` є
  `public static IServiceCollection Add<M>Module(IServiceCollection, IConfiguration)`; усі нащадки `ScheduledJobService`
  лежать у `.Jobs`; усі `IOutboxMessage` модулів — у `.Contracts` (у платформі — лише `IntegrationAlert`).

## 8. Як додати

### Новий зріз у наявному модулі

1. Створіть `Features/<Область>/<Дія>.cs` з `internal static class <Дія>` і `HandleAsync`.
2. Записи запиту/відповіді — у тому ж файлі або в `<Область>Dtos.cs`, якщо їх ділять кілька зрізів. Імена DTO
   стануть іменами схем OpenAPI — перевірте, що вони унікальні.
3. Додайте `Map*` у `<Область>Endpoints.Map` у потрібне місце; адмінка — у групі з `RequireStaff(...)`.
4. Зберіть рішення: оновлений `openapi/polivalko-api.json` комітиться разом зі змінами, а веб перегенеровує типи.
5. Тест — у `tests/PoliValko.IntegrationTests/<Модуль>/`.

### Дані іншого модуля

Додайте метод до порту в `Contracts` модуля-власника (або новий порт), реалізуйте його у
`Features/<Область>/` власника, зареєструйте в `Add<M>Module`. Не читайте `db.Set<ЧужаСутність>()`.

### Новий модуль

1. `src/Modules/PoliValko.<M>/PoliValko.<M>.csproj` за зразком наявних (`FrameworkReference Microsoft.AspNetCore.App`,
   посилання на Infrastructure і потрібні модулі, `InternalsVisibleTo` для тестів); додайте проєкт у `PoliValko.slnx`.
2. Створіть `<M>Module.cs` і теки з розділу 3; сутності — у `Domain/`, конфігурація EF — `Persistence/<M>ModelConfigurator`
   (+ нова схема в `Schemas`, + міграція `dotnet ef migrations add <Назва> --project src/PoliValko.Infrastructure
   --startup-project src/PoliValko.Api --output-dir Persistence/Migrations`).
3. Підключіть модуль у `ApiServices`/`WorkerServices` і його маршрути в `ApiEndpoints` (нові блоки — в кінець
   відповідної групи, щоб не зсувати наявний документ).
4. Додайте модуль у список `ModuleBoundaryTests`; для образу Docker — рядок `COPY` його `.csproj` у
   `deploy/dotnet.Dockerfile`.
