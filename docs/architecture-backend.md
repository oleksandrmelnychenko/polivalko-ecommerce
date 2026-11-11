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
    Media/         MediaOptions, StoredMedia, MediaValidationException, IMediaStorage, LocalMediaStorage, MediaEndpointExtensions,
                   ImageUrls (перевірка адреси фото: відносна /api/media/... або https://)
    Outbox/        IOutboxMessage, IOutboxHandler, IOutbox, EfOutbox, OutboxJson, OutboxMessage, OutboxStatus,
                   OutboxMessageConfiguration, OutboxOptions, OutboxRetryPolicy, OutboxProcessor,
                   OutboxHandlerRegistry, OutboxDispatcherService
    Persistence/   PoliValkoDbContext, IModelConfigurator, Schemas, SqlLike, TrigramSearch, Migrations/ (не змінюються)
    Security/      StaffUser, StaffRole, StaffRolePermission, StaffRoles, StaffClaims, StaffPolicies,
                   IdentityModel, AuthProblems, CsrfFilter, CsrfHeaders, CsrfTokenDto, StaffEndpointExtensions
                   (RequireStaff, RequirePermission, RequireCsrf для маршруту й для групи)
      Permissions/ PermissionKeys, PermissionCatalog, PermissionDefinition, PermissionRequirement,
                   PermissionPolicyProvider, PermissionAuthorizationHandler, IStaffAccessResolver, StaffAccess
    Settings/      PlatformSetting (+Configuration, таблиця platform.settings), ISettingsStore, SettingsStore, SettingsCache
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
    PoliValko.Console/               новий модуль звітів і службових екранів консолі (розділ 5)
    PoliValko.Customers/             особистий кабінет покупця: обліковий запис, вхід, адреси (розділ 5.1)

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
    Customers/      CustomerRulesTests (блокування, токени, правила пароля, коди адрес = коди checkout)
    Delivery/       DeliveryTests, NovaPoshtaClientTests
  PoliValko.IntegrationTests/
    Infrastructure/ ApiFactory (+ [AssemblyFixture] і послідовне виконання; після міграції — синхронізація довідників
                    каталогу й початкові дані сайту; підмінює канал сповіщень менеджеру (RecordingNotifier) і кеш вітрини
                    (RecordingStorefront — записує скинуті теги)), Staff, TestRoles (працівник з роллю з заданими правами), Accounts (покупці: CSRF,
                    реєстрація, вхід), RecordingMailer (перехоплює листи з токенами), TestJson, ProblemBody
    Catalog/        CatalogApiTests, CatalogFacetsTests, ConsoleCatalogApiTests, ConsoleProductStockApiTests, FavoritesApiTests,
                    ConsoleAttributeApiTests, ConsoleBrandApiTests, ConsoleLabelApiTests, ConsoleProductFiltersApiTests,
                    CategoryContentAndSeoApiTests, CatalogDictionaries (помічник)
    Content/        ServiceRequestApiTests, SiteContentApiTests, SiteHomeApiTests, PageSeoAndServiceApiTests, SeoTemplatesApiTests
    Customers/      AccountApiTests, AccountAddressApiTests, ConsoleAccountApiTests
    Delivery/       DeliveryApiTests, DeliverySettingsApiTests
    Identity/       AuthApiTests, StaffApiTests, RoleApiTests
    Ordering/       CheckoutApiTests, ConsoleOrderApiTests, ConsoleCustomerApiTests, AccountOrderApiTests,
                    ConsoleRefundAndNoteApiTests, ShopSettingsApiTests, TestOrders
    Payments/       PaymentsApiTests
    Console/        ConsoleDashboardApiTests, ConsoleSearchApiTests, IntegrationApiTests, ConsoleMediaAndPermissionApiTests,
                    PaymentSettingsApiTests
    Notifications/  NotificationSettingsApiTests
```

## 2. Правила залежностей

| Хто | Може використовувати |
| --- | --- |
| `PoliValko.SharedKernel` | лише BCL |
| `PoliValko.Infrastructure` | SharedKernel, пакети ASP.NET Core / EF Core |
| Модуль `PoliValko.<M>` | SharedKernel, Infrastructure (усе), власні типи, **лише** простір імен `PoliValko.<Інший>.Contracts` інших модулів |
| `PoliValko.Console` | так само, як будь-який модуль: лише `Contracts` інших модулів плюс платформні таблиці Infrastructure (outbox, sync, audit) |
| `PoliValko.Api`, `PoliValko.Worker` | SharedKernel, Infrastructure, клас `PoliValko.<M>.<M>Module` кожного модуля і `Contracts`; жодних запитів до БД (без `System.Linq.Queryable` і `EntityFrameworkQueryableExtensions`), жодних власних DTO |

Додатково:

- Посилання між проєктами (`ProjectReference`): Content → Notifications; Customers → Delivery, Notifications;
  Catalog → Customers; Ordering → Catalog, Customers, Delivery, Notifications; Payments → Customers, Ordering;
  Fiscal → Customers, Ordering; Navkolo → Catalog, Ordering; Console → Catalog, Content, Delivery, Fiscal, Navkolo,
  Ordering, Payments. Межу задає не посилання на проєкт, а простір імен `Contracts`, і її перевіряє архітектурний тест.
- Customers стоїть «вище» за Catalog, Ordering, Fiscal і Payments: їм потрібні з його `Contracts` ідентифікатор
  покупця з `ClaimsPrincipal`, політика й `RequireCustomer()`. Тому Customers не може посилатися на Catalog чи
  Ordering (цикл проєктів). Звідси два рішення: коди способів доставки збережених адрес Customers тримає у власному
  `AddressDeliveryCodes` (ті самі рядки, що `DeliveryCodes` в Ordering; рівність перевіряє юніт-тест), а прив'язку
  гостьових замовлень після підтвердження email робить Ordering через гачок `ICustomerEmailConfirmedHandler`
  з `Customers.Contracts` (див. «Як модулі говорять між собою», п. 4).
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
4. **Гачки (зворотні порти)** — інтерфейс у `Contracts` модуля, який сам не може звернутися до споживача, а
   реалізація — у модулі нижче за графом посилань. Так `ICatalogFreshness` з Catalog реалізує Navkolo, а
   `ICustomerEmailConfirmedHandler` з Customers реалізує Ordering (`Features/Account/LinkGuestOrders`). Customers
   отримує всі реалізації (`IEnumerable<…>`) і викликає їх до свого `SaveChangesAsync`; реалізація лише змінює
   відстежені сутності, тож підтвердження email і прив'язка замовлень зберігаються однією транзакцією.

Карта контрактів:

| Модуль | `Contracts` |
| --- | --- |
| Catalog | `ICatalogPricing` + `ProductPricing`; `ICatalogFreshness`; `ICatalogImporter` + `NavkoloProductRecord`, `PriceStockRecord`, `CatalogImportResult`; `ProductAttributeDto`; `ICatalogDemoFeed` (джерело демо-записів для заглушки Navkolo); `ICatalogReporting` (картки товарів, товари, що закінчуються, пошук товарів для консолі) |
| Content | `ServiceRequestSubmitted`; `IServiceRequestStats` (кількість нових заявок) |
| Delivery | `IDeliveryDirectory` (населені пункти й відділення), `Settlement`, `Warehouse`, `WarehouseType`, `PickupPoint`; `IDeliveryAvailability` + `DeliveryAvailability` (які способи доставки й чи є післяплата зараз увімкнені, точка самовивозу — лише коли самовивіз увімкнений і є активна точка); `DeliveryJobs.NovaPoshtaDirectory` |
| Navkolo | `NavkoloJobs`; `ImportRunDto` (+ `ImportRunDto.From(SyncRun)`); `INavkoloSettings` (режим інтеграції) |
| Customers | `CustomerClaims` (тип claim, `CustomerId(ClaimsPrincipal)` → `Guid?`), `CustomerPolicies.Customer`, `CustomerEndpointExtensions.RequireCustomer()` (політика + CSRF + 401 у документі); порт `ICustomerDirectory` (Ordering: id покупця з підтвердженим email); гачки `ICustomerEmailConfirmedHandler` (реалізує Ordering), `ICustomerOrderHistory` + `CustomerOrderRecord` (Ordering: кількість і останні замовлення покупця для консолі, статус — рядок у camelCase, як у JSON) і `ICustomerFavoritesCounter` (Catalog: кількість обраного) |
| Notifications | `IManagerNotifier`, `ManagerNotification` (+ `ManagerEvent` — подія, за якою працює перемикач у налаштуваннях сповіщень); `ICustomerMailer` (листи покупцю: підтвердження email, відновлення пароля) |
| Ordering | повідомлення `OrderPlaced`, `PaymentSucceeded`, `OrderPaidAfterCancel`, `OrderExportRequested`, `OrderCancellationRequested`, `PaymentCancellationRequested` + `PaymentCancellationReason`, `FiscalReceiptRequested` + `FiscalTrigger`, `RefundRequested`; перелічення `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `DeliveryMethod`, `RefundMethod`, `RefundStatus`; `DeliveryCodes`, `PaymentCodes`, `OrderProblems`; `OrderStatusCountDto` + `OrderStatusCounts`; порти `IOrderPayments` (Payments; `FindPayableForCustomerAsync` — для оплати з кабінету; `LockPayableAsync` — блокування рядка замовлення на час відкриття рахунку; `RecordOutsideRefundAsync` — повернення, зроблене провайдером поза сайтом), `IOrderReceiptSource` (Fiscal; `BelongsToCustomerAsync` — чеки в кабінеті), `IOrderExportSource` (Navkolo), `IOrderReporting` (Console), гачок `IRefundReceiptStatuses` (реалізує Fiscal: стан останнього чека повернення за id повернення) і їхні записи-знімки (`PayableOrder`, `OrderPaymentTarget`, `PaidOrderResult`, `RefundToProcess`, `SubmittedRefund`, `OrderForReceipt`, `OrderForExport`, `OrderPeriodRow`, `ProductSalesRow`, `OrderedProductSnapshot`, `OrderSearchHit`, `CustomerSearchHit`); `SellerOptions` — у `Configuration` |
| Payments | `PaymentJobs.Reconcile`; `IPaymentSettings` (провайдер і режим для консолі) |
| Fiscal | `IFiscalSettings` (провайдер ПРРО, режим і коли видається чек для кожного способу оплати) |
| Identity, Console | порожньо (нікому не потрібні) |

Спільну для Identity й Customers схему OpenAPI `CsrfTokenDto` перенесено в `Infrastructure.Security`: обидва
маршрути `.../csrf` повертають ту саму схему, ім'я й форма в документі не змінилися.

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

- Простір імен = шлях теки (`Features/Console/Products/UpdateProduct.cs` → `PoliValko.Catalog.Features.Console.Products`).
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
- Велика область консолі ділиться на підобласті з власним `<Підобласть>Endpoints.Map(group)`. Батьківський
  `ConsoleCatalogEndpoints.Map` створює спільну групу `/catalog` і викликає підобласті в порядку документа OpenAPI:
  товари, назви характеристик, розділи, добірки, перенаправлення.
- Службові записи, які бачить лише один клас, вкладаються в нього (`CheckoutCalculator.PricedLine`,
  `OrderValidator.ValidatedOrder`, `ProductListing.ListItemRow`, `OrderCsv.Row`), щоб у файлі лишався один тип
  верхнього рівня. DTO-схеми OpenAPI, які потрібні одному зрізу, лежать в окремому файлі (`AttributeNameDto.cs`,
  `ConsolePaymentDto.cs`), а не всередині класу зрізу: вкладеність впливає на ім'я схеми (розділ 6.1).
- Категорії логерів, що створюються через `ILoggerFactory`, беруть клас зрізу (`StartPayment`, `ReceiveWebhook`).

### Розкладка Catalog, Ordering, Payments

```
PoliValko.Catalog/
  CatalogModule.cs  Contracts/  Configuration/CatalogOptions
  Domain/                  Category, HomeCollection, UrlRedirect, Product, ProductPrice, ProductStock, ProductImage,
                           ProductAttribute, TopLevelCategories, AttributeDefinition (+ AttributeKind, AttributeFilterView),
                           Brand, ProductLabel (правило AppliesTo) + ProductLabelLink, LabelKind, LabelTone
  Persistence/             CatalogModelConfigurator, CatalogDemoData, demo-catalog.json, CatalogDictionarySync (довідники
                           характеристик і брендів з товарів, початкові мітки), ProductLabelSet (мітки для сторінки товарів)
  Features/Storefront/     CatalogEndpoints; GetCategoryTree, GetCategory, SearchProducts, GetProduct, GetPhotoCredits,
                           GetCollections, GetSitemap, ResolveRedirect; StorefrontDtos (+ ProductSearchQuery, ProductSort);
                           ProductFacetBuilder, ProductListing, ProductSearchText, CategoryQueries, SeoTemplates (мета-шаблони з seo.templates)
  Features/Console/        ConsoleCatalogEndpoints (група /catalog), CatalogConsoleValidation (+ бренд і ручні мітки)
    Products/              ProductEndpoints; ListProducts, SetProductsVisibility, GetConsoleProduct, UpdateProduct,
                           UploadProductImage, UpdateProductImages, DeleteProductImage, CountProducts, BulkUpdateProducts;
                           ConsoleProductDtos, ConsoleProductQueries, ConsoleProductFilter, ProductStockFilters,
                           ProductFillFilters, ProductLabelLinks
    AttributeNames/        AttributeNameEndpoints, ListAttributeNames, AttributeNameDto
    Attributes/            AttributeEndpoints; ListAttributeDefinitions, CreateAttributeDefinition, UpdateAttributeDefinition,
                           DeleteAttributeDefinition; AttributeDefinitionEditor, AttributeUsage, ConsoleAttributeDtos
    Brands/                BrandEndpoints; ListBrands, CreateBrand, UpdateBrand, DeleteBrand, MergeBrand; BrandEditor,
                           ConsoleBrandDtos
    Labels/                LabelEndpoints; ListLabels, CreateLabel, UpdateLabel, DeleteLabel; LabelEditor, ConsoleLabelDtos
    Categories/            CategoryEndpoints; ListCategories, CreateCategory, UpdateCategory, DeleteCategory;
                           CategoryEditor (зокрема ToDto), ConsoleCategoryDtos
    Collections/           CollectionEndpoints; ListCollections, CreateCollection, UpdateCollection, DeleteCollection;
                           CollectionEditor (зокрема ToDto), ConsoleCollectionDtos
    Redirects/             RedirectEndpoints; ListRedirects, CreateRedirect, DeleteRedirect; RedirectWriter,
                           ConsoleRedirectDtos
  Features/Import/         CatalogImporter (ICatalogImporter), ImportValidation, ProductFieldWriter, ImportText,
                           CatalogDemoFeed (ICatalogDemoFeed: записи демо-каталогу у форматі Navkolo)
  Features/Favorites/      FavoriteEndpoints (група /account/favorites, RequireCustomer); ListFavorites, ListFavoriteIds,
                           AddFavorite, RemoveFavorite (сутність Domain/Favorite, таблиця catalog.favorites);
                           CustomerFavoritesCounter (ICustomerFavoritesCounter)
  Features/Pricing/        CatalogPricing (ICatalogPricing), AlwaysFreshCatalog (ICatalogFreshness)
  Features/Reporting/      CatalogReporting (ICatalogReporting)

PoliValko.Ordering/
  OrderingModule.cs  Contracts/  Configuration/SellerOptions
  Domain/                  Order, OrderItem, OrderStatusChange, OrderRefund, OrderRefundLine, OrderTokens, OrderTransitions,
                           OrderActors (хто змінив статус: «Покупець», «Платіжна система»)
  Persistence/             OrderingModelConfigurator, OrderLoader (агрегат з позиціями, історією й поверненнями)
  Features/Checkout/       CheckoutEndpoints; QuoteCheckout, CreateOrder, GetOrder, GetSeller; CheckoutCalculator
                           (способи доставки й оплати з IDeliveryAvailability), OrderValidator, OrderMapping (CanPay — і для
                           IOrderPayments), CheckoutDtos (+ QuoteIssues)
  Features/Shop/           ShopSettingsEndpoints (група /settings/shop); GetShopSettings, SaveShopSettings; ShopSettingsStore
                           (ключ settings.shop, запасні реквізити з SellerOptions), ShopSettingsDtos
  Features/Console/Orders/ ConsoleOrderEndpoints; ListOrders, CountOrders, ExportOrders, GetConsoleOrder, ChangeOrderStatus,
                           CreateRefund, UpdateOrderNote; ConsoleOrderDtos, ConsoleOrderMapping, ConsoleOrderFilter,
                           ConsoleOrderSorts, OrderSearch, OrderCsv
  Features/Console/Customers/ ConsoleCustomerEndpoints; ListCustomers; CustomerContacts; ConsoleCustomerDtos
  Features/Console/Refunds/ ConsoleRefundEndpoints (група /refunds); ListRefunds; ConsoleRefundDtos, RefundChannel
  Features/Account/        AccountOrderEndpoints (група /account/orders, RequireCustomer); ListAccountOrders,
                           GetAccountOrder; AccountOrderDtos; LinkGuestOrders (ICustomerEmailConfirmedHandler);
                           CustomerOrderHistory (ICustomerOrderHistory)
  Features/Notifications/  NotifyManagerOnOrderPlaced, NotifyManagerOnPaymentSucceeded, NotifyManagerOnOrderPaidAfterCancel,
                           OrderMoney
  Features/PaymentState/   OrderPayments          Features/Receipts/   OrderReceiptSource
  Features/Export/         OrderExportSource      Features/Reporting/  OrderReporting

PoliValko.Payments/
  PaymentsModule.cs  Contracts/PaymentJobs  Configuration/ PaymentsOptions, SandboxOptions, MonoOptions
  Domain/                  PaymentAttemptStatus, Payment, PaymentEvent, SandboxInvoice
  Persistence/             PaymentsModelConfigurator
  Integrations/Providers/  IPaymentProvider, IPaymentProviders, PaymentProviders, PaymentProviderNames,
                           PaymentBasketItem, InvoiceRequest, CreatedInvoice, ProviderPaymentState,
                           ProviderPaymentStatus, ProviderRefundResult, ProviderRefundState, PaymentWebhookRejectedException
  Integrations/Mono/       MonoPaymentProvider (записи формату monobank вкладені)
  Integrations/Sandbox/    SandboxPaymentProvider
  Features/Checkout/       PaymentEndpoints (Map; MapAccount — /account/orders/{number}/payments); StartPayment
                           (HandleAsync за токеном + спільний StartAsync), StartAccountPayment, ReceiveWebhook,
                           GetSandboxInvoice, CompleteSandboxPayment; PaymentDtos
  Features/Console/        ConsolePaymentEndpoints, ListOrderPayments, ConsolePaymentDto
  Features/Processing/     PaymentProcessor (зайва оплата → тривога; сторно провайдера → облік на замовленні), PaymentUpdateResult
  Features/Refunds/        ProcessRefundRequested, RefundSettlement (надсилання з ключем до запиту; звірка «processing»)
  Features/Cancellation/   CancelOpenPayments (анулює неоплачені рахунки скасованого замовлення)
  Features/Settings/       PaymentSettings (IPaymentSettings)
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
  `SiteContentMapping` (+ `Clean`, `PageNotFound`), `ConsoleServiceRequestMapping`, `ConsolePickupPointMapping`,
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
                           SiteContacts, ServiceDirectionContent, Banner
  Persistence/             ContentModelConfigurator, SiteSeeder (початкові банери, головна й мета-шаблони)
  Features/ServiceRequests/ ServiceRequestEndpoints; GetServiceDirections, SubmitServiceRequest (+ Validate);
                           ServiceRequestDtos; NotifyManagerOnServiceRequest; ServiceRequestStats (IServiceRequestStats)
    Console/               ConsoleServiceRequestEndpoints; ListServiceRequests, ChangeServiceRequestStatus;
                           ConsoleServiceRequestDtos, ConsoleServiceRequestMapping
  Features/SiteContent/    SiteContentEndpoints (pages, contacts), ConsoleSiteContentEndpoints (група /content);
                           GetPage, GetContacts, ListPages, SavePage, SaveContacts, ListServiceDirections,
                           SaveServiceDirection; SiteContentDtos, SiteContentMapping, ShopSpecialDays (особливі дні з
                           settings.shop для контактів)
  Features/Site/           SiteEndpoints (GET /site/home), ConsoleSiteEndpoints (група /site); GetSiteHome, GetHomeSettings,
                           SaveHomeSettings, ListBanners, CreateBanner, UpdateBanner, DeleteBanner, ReorderBanners,
                           GetSeoTemplates, SaveSeoTemplates; HomeSettingsStore (site.home), SeoTemplateSettings
                           (seo.templates), BannerEditor, ActiveBanners (кеш діючих банерів), SiteLinks, SiteDtos

PoliValko.Delivery/
  DeliveryModule.cs  Contracts/  Configuration/NovaPoshtaOptions
  Domain/                  NpSettlement, NpWarehouse, PickupLocation, DeliveryLimits
  Persistence/             DeliveryModelConfigurator
  Integrations/NovaPoshta/ NovaPoshtaClient, NovaPoshtaResponseParser, NovaPoshtaMapper, NovaPoshtaException,
                           NovaPoshtaArea, NovaPoshtaPage<T>, NovaPoshtaRequest, NovaPoshtaText
  Features/Directory/      DemoNovaPoshtaDirectory, NovaPoshtaDbDirectory (IDeliveryDirectory), PickupPointStore
  Features/Storefront/     DeliveryEndpoints; SearchSettlements, GetWarehouses, GetPickupPoints; DeliveryDtos
  Features/Console/        ConsoleDeliveryEndpoints; ListPickupPoints, UpdatePickupPoint (+ Validate, PickupPointValues),
                           GetNovaPoshtaStatus; ConsoleDeliveryDtos, ConsolePickupPointMapping
  Features/Settings/       DeliverySettingsEndpoints (група /settings/delivery); GetDeliverySettings, SaveDeliverySettings;
                           DeliverySettingsStore (settings.delivery), DeliveryAvailabilityReader (IDeliveryAvailability),
                           DeliverySettingsDtos
  Features/DirectorySync/  NovaPoshtaDirectorySync (+ RecountActiveWarehousesSql)
  Jobs/                    NovaPoshtaSyncJob

PoliValko.Fiscal/
  FiscalModule.cs  Configuration/ FiscalOptions, CheckboxOptions
  Domain/                  Receipt, ReceiptKind, ReceiptStatus, ReceiptMoment
  Persistence/             FiscalModelConfigurator
  Integrations/Providers/  IFiscalProvider, ReceiptGood, ReceiptDraft, IssuedReceipt
  Integrations/Stub/       StubFiscalProvider
  Integrations/Checkbox/   CheckboxFiscalProvider (записи формату Checkbox вкладені)
  Features/Receipts/       ReceiptEndpoints (Map, MapConsole, MapAccount); GetOrderReceipts, ListOrderReceipts,
                           GetAccountOrderReceipts; ReceiptQueries, ReceiptDto; RefundReceiptStatuses (IRefundReceiptStatuses)
  Features/Issuing/        IssueReceiptOnRequest
  Features/Settings/       FiscalSettings (IFiscalSettings)

PoliValko.Identity/
  IdentityModule.cs
  Persistence/             IdentitySeeder
  Features/Auth/           AuthEndpoints; Login, Logout, Me, GetCsrfToken; AuthDtos; StaffClaimsFactory
  Features/Staff/          StaffEndpoints (група /users, потім /auth/password); ListStaffUsers, CreateStaffUser,
                           UpdateStaffUser, LockStaffUser, ResetStaffPassword, ResetStaffTwoFactor, ChangeOwnPassword;
                           StaffDtos, StaffValidation, StaffMapping
  Features/TwoFactor/      TwoFactorEndpoints (група /auth/two-factor); OwnTwoFactor (стан, ключ, увімкнення, резервні
                           коди, вимкнення), TwoFactorCodes (TOTP, резервні коди, otpauth-адреса),
                           SuperuserConfirmation (код для ролі адміністратора); TwoFactorDtos

PoliValko.Navkolo/
  NavkoloModule.cs  Contracts/  Configuration/ NavkoloOptions, StubOptions, NavkoloModes
  Integrations/NavkoloApi/ INavkoloClient, NavkoloOrder, NavkoloOrderLine, NavkoloUnavailableException, StubNavkoloClient
  Features/CatalogImport/  CatalogImportEndpoints; ImportCatalogFile; CatalogFileParser (CSV і JSON)
  Features/Freshness/      NavkoloFreshness (ICatalogFreshness)
  Features/OrderExport/    ExportOrderToNavkolo
  Features/Settings/       NavkoloSettings (INavkoloSettings)
  Jobs/                    NavkoloPriceStockJob, NavkoloCatalogJob

PoliValko.Notifications/
  NotificationsModule.cs  Contracts/ IManagerNotifier, ManagerNotification, ManagerEvent, ICustomerMailer
  Configuration/           TelegramOptions, EmailOptions, EmailModes
  Integrations/Channels/   IManagerChannel (канал доставки: Telegram або лог)
  Integrations/Telegram/   TelegramManagerNotifier (IManagerChannel)
  Integrations/Log/        LogManagerNotifier (IManagerChannel), LogCustomerMailer
  Features/Dispatch/       ManagerNotifier (IManagerNotifier: перемикачі подій і чати з налаштувань, далі — канал)
  Features/Settings/       NotificationSettingsEndpoints (група /settings/notifications); GetNotificationSettings,
                           SaveNotificationSettings, SendTestNotification; NotificationSettingsStore, NotificationSettingsDtos
  Features/IntegrationAlerts/ NotifyResponsibleOnIntegrationAlert

PoliValko.Customers/
  CustomersModule.cs       AddCustomersModule, MapAccountEndpoints
  Contracts/               CustomerClaims, CustomerPolicies, CustomerEndpointExtensions (RequireCustomer),
                           ICustomerDirectory, ICustomerEmailConfirmedHandler
  Domain/                  Customer (блокування, зміна пароля зі зміною security stamp), CustomerEmail (нормалізація),
                           CustomerAddress, AddressDeliveryCodes, CustomerToken (+ Issue, Hash), CustomerTokenPurpose
  Persistence/             CustomersModelConfigurator, CustomerLoader (покупець за claims), CustomerTokenQueries
  Features/                AccountEndpoints (група /account: спершу анонімні маршрути з CSRF, потім група RequireCustomer)
  Features/Auth/           CustomerAuthentication (схеми й політика), CustomerSession (вхід/вихід, claims),
                           CustomerSessionValidator (OnValidatePrincipal), CustomerPasswords, CustomerValidation,
                           CustomerMapping, AccountProblems; GetAccountCsrfToken, Register, Login, Logout, GetMe; AccountDtos
  Features/Profile/        UpdateProfile, ChangePassword; ProfileDtos
  Features/Confirmation/   ConfirmEmail, ResendConfirmation; ConfirmationDtos
  Features/Recovery/       ForgotPassword, ResetPassword; RecoveryDtos
  Features/Addresses/      AddressEndpoints; ListAddresses, CreateAddress, UpdateAddress, DeleteAddress;
                           AddressValidation (через IDeliveryDirectory), AddressMapping, AddressDtos
  Features/Mail/           AccountMail (посилання {Site:PublicUrl}/account/... і відправлення через ICustomerMailer)
  Features/Directory/      CustomerDirectory (ICustomerDirectory)
  Features/Console/        ConsoleAccountEndpoints (група /console/accounts); ListAccounts, GetAccount, SetAccountLock,
                           SendAccountPasswordReset; ConsoleAccountDtos (+ ConsoleAccountStatuses), ConsoleAccountMapping
```

### Точка входу `<M>Module`

```csharp
public static class CatalogModule
{
    public static IServiceCollection AddCatalogModule(this IServiceCollection services, IConfiguration configuration);
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder api);
    public static RouteGroupBuilder MapConsoleCatalogEndpoints(this RouteGroupBuilder console);
    public static Task SeedDemoDataAsync(IServiceProvider services, CancellationToken ct = default);
}
```

- `Add<M>Module(IServiceCollection, IConfiguration)` — у кожного модуля однакова сигнатура (параметр
  `configuration` може не використовуватися). Реєструє налаштування, `IModelConfigurator`, сервіси, порти,
  обробники outbox і заглушки інтеграцій.
- `Add<M>Jobs(IServiceCollection)` — лише якщо в модуля є фонові завдання; викликає тільки Worker.
- `Map<Область>Endpoints(this IEndpointRouteBuilder api)` — публічний API області;
  `MapConsole<Область>Endpoints(this RouteGroupBuilder console)` — консоль області. Одна функція на кожен блок, який
  у документі OpenAPI стоїть окремо (див. порядок у розділі 4), тож хост задає порядок, а модуль — вміст.
- Сідери, які запускає хост: `CatalogModule.SeedDemoDataAsync`, `CatalogModule.SyncDictionariesAsync`,
  `ContentModule.SeedSiteAsync` (лише порожні дані сайту, розділ 5.4), `IdentityModule.SeedUsersAsync`.

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
  Payments, Fiscal, Navkolo, Identity, Notifications, Console, Customers (новий модуль — у кінці, щоб не зсувати
  порядок `IModelConfigurator` і решти реєстрацій); далі `AddApiProblemDetails`, `AddApiRateLimiting`,
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
           Ordering.MapCheckoutEndpoints             (checkout/quote, checkout/delivery-methods, orders, orders/{number}, seller)
           Payments.MapPaymentEndpoints
           Fiscal.MapReceiptEndpoints                (orders/{number}/receipts)
           Content.MapSiteEndpoints                  (site/home; власна група /site)
/console:  Identity.MapConsoleAuthEndpoints
           Identity.MapConsoleStaffEndpoints         (users..., auth/password)
           Console.MapConsoleSummaryEndpoints
           Console.MapConsoleDashboardEndpoints
           Console.MapConsoleSearchEndpoints
           Ordering.MapConsoleOrderEndpoints
           Ordering.MapConsoleCustomerEndpoints
           Payments.MapConsolePaymentEndpoints
           Fiscal.MapConsoleReceiptEndpoints
           Catalog.MapConsoleCatalogEndpoints
           Content.MapConsoleSiteContentEndpoints
           Navkolo.MapConsoleCatalogImportEndpoints  (integration/navkolo/import)
           Console.MapConsoleIntegrationEndpoints    (integration/status, runs, jobs, outbox, audit)
           Content.MapConsoleServiceRequestEndpoints
           Delivery.MapConsoleDeliveryEndpoints
           Ordering.MapConsoleRefundEndpoints        (refunds)
           Customers.MapConsoleAccountEndpoints      (accounts, accounts/{id}, lock, password-reset)
           Console.MapConsoleMediaEndpoints          (media/images)
           Content.MapConsoleSiteEndpoints           (site/home, site/banners, site/banners/order, site/seo-templates)
           Ordering.MapConsoleShopSettingsEndpoints  (settings/shop)
           Delivery.MapConsoleDeliverySettingsEndpoints (settings/delivery)
           Console.MapConsolePaymentSettingsEndpoints (settings/payments)
           Notifications.MapConsoleNotificationSettingsEndpoints (settings/notifications, settings/notifications/test)
/api/v1:   Customers.MapAccountEndpoints             (account/csrf, register, login, logout, email/confirm,
           (після консолі)                            password/forgot, password/reset, me, profile, password,
                                                      email/resend, addresses, addresses/{id})
           Ordering.MapAccountOrderEndpoints         (account/orders, account/orders/{number})
           Fiscal.MapAccountReceiptEndpoints         (account/orders/{number}/receipts)
           Payments.MapAccountPaymentEndpoints       (account/orders/{number}/payments)
           Catalog.MapAccountFavoriteEndpoints       (account/favorites, favorites/ids, favorites/{productId})
```

Цей порядок визначає порядок шляхів у `openapi/polivalko-api.json`; змінювати його не можна. Блоки кабінету
мапляться після консолі й кожен через власний `MapGroup(...)`: прямі `api.MapGet/MapPost` потрапили б у спільне
джерело маршрутів групи `/api/v1` (його створює `Fiscal.MapReceiptEndpoints`) і стали б у документі перед маршрутами консолі.
Наявні операції документа від цього не змінилися (diff `openapi/` — лише додані рядки).

- `ApiDatabase.PrepareDatabaseAsync` — та сама логіка `Database:ApplyMigrationsOnStartup`, `Database:SeedDemoData`,
  `Seed:Users`: міграція, перевірка незастосованих міграцій, `CatalogModule.SeedDemoDataAsync`,
  `CatalogModule.SyncDictionariesAsync` (завжди, ідемпотентно: довідники характеристик і брендів, початкові мітки),
  `ContentModule.SeedSiteAsync` (завжди, ідемпотентно: заповнює лише порожні дані сайту), `IdentityModule.SeedUsersAsync`.

### Worker (`src/PoliValko.Worker`)

`WorkerServices.AddPoliValkoWorker(configuration)`: `AddPlatform()`, модулі Catalog, Content, Delivery, Ordering,
Payments, Fiscal, Navkolo, Notifications (без Identity, Console і Customers), потім `AddPlatformJobs()`, `AddDeliveryJobs()`,
`AddPaymentsJobs()`, `AddNavkoloJobs()` — порядок реєстрації hosted services не змінюється. Модель EF у Worker не
містить таблиць `customers.*` (він їх не читає й не мігрує БД); збірка Customers потрапляє у Worker лише як залежність
Ordering, Catalog, Payments і Fiscal.

## 5. Модуль Console

`src/Modules/PoliValko.Console` — службові екрани консолі: зведення для меню, огляд, пошук Ctrl+K, інтеграції й журнал
змін. Він — звичайний модуль: читає інші модулі лише через порти з їхніх `Contracts`
(`IOrderReporting`, `ICatalogReporting`, `IServiceRequestStats`, `ICatalogFreshness`, `INavkoloSettings`) і напряму —
лише платформні таблиці Infrastructure (outbox, стан і журнал синхронізацій, аудит).

Чому порти, а не «спільний read-only доступ до чужих сутностей»: кожен запит зведення й так був окремим зверненням до
БД (замовлення, товари, позиції, залишки), тож перенесення запиту в метод порту власника дає той самий SQL,
а схема таблиць модуля лишається його внутрішньою справою.

```
PoliValko.Console/
  ConsoleModule.cs              AddConsoleModule, MapConsoleSummaryEndpoints, MapConsoleDashboardEndpoints,
                                MapConsoleSearchEndpoints, MapConsoleIntegrationEndpoints, MapConsoleMediaEndpoints,
                                MapConsolePaymentSettingsEndpoints
  Features/Summary/             GetConsoleSummary, ConsoleSummaryDto
  Features/Dashboard/           GetConsoleDashboard, DashboardDtos (ConsoleDashboardDto, DashboardTotalsDto, ...)
  Features/Search/              SearchConsole, SearchDtos (ConsoleSearchDto, SearchOrderHitDto, ...)
  Features/Integration/         IntegrationEndpoints (status, runs, jobs/{job}/run, outbox, outbox/{id}/retry, audit),
                                GetIntegrationStatus, ListSyncRuns, RequestJobRun, ListOutbox, RetryOutboxMessage,
                                SyncJobTitles, IntegrationDtos
  Features/Audit/               ListAudit, AuditDtos (AuditEntryDto, AuditQuery)
  Features/Media/               UploadContentImage (POST /console/media/images → { url }, тека content), UploadedImageDto
  Features/Settings/            GetPaymentSettings (GET /console/settings/payments через IPaymentSettings, IFiscalSettings і
                                стан завдання payments.reconcile), PaymentSettingsDtos
```

Блоки `summary`, `dashboard` і `search` мають по одному маршруту, тож їхні ланцюжки мапінгу стоять просто в
`ConsoleModule`; блок інтеграцій (разом з `audit`) мапить `IntegrationEndpoints.Map`. Обробники отримують порти через
`[FromServices]`, у документі OpenAPI вони не з’являються.

`SyncJobTitles` зберігає той самий порядок ключів (`navkolo.price-stock`, `navkolo.catalog`, `navkolo.import`,
`novaposhta.directory`, `payments.reconcile`) — від нього залежить порядок завдань у відповіді `integration/status`.

## 5.1 Модуль Customers (особистий кабінет покупця)

Гостьова покупка лишається такою, як була (ТЗ: «У першому запуску покупка залишається гостьовою»); кабінет —
додаткова можливість. Покупець входить за email і паролем.

**Схеми автентифікації.**

- Cookie-схема `Customer`: cookie `pv_customer`, HttpOnly, SameSite=Lax, Secure — як у запиті, 30 днів із ковзним
  продовженням, постійна (переживає закриття браузера). Claims: `NameIdentifier` = id покупця, `Email`, `Name`,
  `customer_stamp`; тип ідентичності — `Customer` (`CustomerClaims.AuthenticationType`).
- Типова схема — policy scheme `PoliValko`: шляхи `/api/v1/console/**` → cookie працівника
  (`IdentityConstants.ApplicationScheme`, `pv_console`), усе інше → `Customer`. Її задає `PostConfigure<AuthenticationOptions>`,
  тож результат не залежить від порядку реєстрації модулів (Identity й далі викликає `AddAuthentication(ApplicationScheme)`).
  Навіщо: antiforgery прив'язує токен до `HttpContext.User`, а `UseAuthentication` заповнює його лише типовою схемою;
  так CSRF кабінету видається й перевіряється від імені покупця, а `POST /orders` бачить покупця, що увійшов. На шляхах
  консолі схема та сама, що й раніше, тож поведінка працівників не змінилась.
- Політика `customer` (`CustomerPolicies.Customer`) явно автентифікує схему `Customer` і вимагає id покупця. Cookie
  працівника на `/api/v1/account/**` дає 401, cookie покупця на `/api/v1/console/**` — теж 401.
- 401/403 — Problem Details з кодами `auth.unauthorized` / `auth.forbidden` («Увійдіть до особистого кабінету.»), як у
  працівників (спільний `AuthProblems.WriteAsync`).
- Security stamp: `CustomerSessionValidator` (`OnValidatePrincipal`) на кожному запиті звіряє stamp і блокування з БД. Немає покупця або stamp інший — principal відхиляється, cookie видаляється; інакше
  за потреби оновлюється ім'я у claims. Зміна й відновлення пароля змінюють stamp, тож інші сесії
  завершуються не пізніше ніж за інтервал; зміна пароля одразу перевидає cookie поточної сесії. У тестах інтервал 0.

**CSRF.** Той самий antiforgery і `CsrfFilter`, що й у консолі (cookie `pv_csrf`, заголовок `X-CSRF-TOKEN`).
`GET /api/v1/account/csrf` видає токен; усі зміни в кабінеті, зокрема реєстрація, вхід, вихід, підтвердження email і
відновлення пароля, потребують заголовка (інакше 400 `auth.csrf_invalid`). Токен прив'язаний до покупця (claim
`NameIdentifier`), тому після реєстрації, входу й виходу клієнт бере новий токен; зміна пароля чи профілю токен не змінює.
Гостьовий `POST /orders` CSRF не вимагає, як і раніше: cookie `SameSite=Lax` не надсилається в міжсайтових POST.

**Паролі й блокування.** `PasswordHasher<Customer>` з ASP.NET Core Identity (окремий від працівників). Пароль — 8–128
символів і не збігається з email. 5 невдалих входів поспіль блокують вхід на 15 хв (`Customer.MaxFailedLogins`,
`Customer.LockoutDuration`). Невідомий email, хибний пароль і заблокований запис дають однакову відповідь
401 `account.invalid_credentials`; для невідомого email хеш усе одно перевіряється, щоб час відповіді не видавав
наявність запису. Відновлення пароля знімає блокування. Дубль email під час реєстрації — помилка валідації `email`
(без урахування регістру).

**Токени з листів.** Таблиця `customers.customer_tokens`: у посиланні 256 випадкових біт у base64url, у БД — лише
SHA-256 (hex). Підтвердження email діє 3 доби, відновлення пароля — 1 годину; токени одноразові (`used_at`). Новий
пароль (зміна чи відновлення) погашає всі відкриті токени відновлення. Токени не потрапляють в outbox: листи
надсилаються синхронно із запиту через `ICustomerMailer` (Notifications). Помилка відправлення логується й не
скасовує реєстрацію чи «забули пароль»; повторний лист у такому разі відповідає 503 `account.mail_unavailable`.
Посилання: `{Site:PublicUrl}/account/confirm-email?token=…` і `{Site:PublicUrl}/account/reset-password?token=…`.

**Замовлення.** Колонка `ordering.orders.customer_id` (nullable, індекс `(customer_id, created_at)`);
`Order.LinkCustomer` ставить її лише один раз. `CreateOrder`: покупець із cookie → його id; інакше, якщо email
замовлення належить покупцю з підтвердженим email (`ICustomerDirectory`), → id цього покупця. Відповідь і потік
гостьового checkout не змінилися. Після підтвердження email `LinkGuestOrders` прив'язує замовлення без покупця з тим
самим email (без урахування регістру, `upper(customer_email)`). Кабінет бачить лише свої замовлення, чужі — 404
`ordering.order_not_found`. Деталі — той самий `OrderDto`, що й на гостьовій сторінці; чеки — `GET
/account/orders/{number}/receipts` (Fiscal); оплата неоплаченого карткового замовлення — `POST
/account/orders/{number}/payments` (Payments; без `Idempotency-Key`, бо повторний виклик і так повертає активну
спробу), повернення з платіжної сторінки — на `{Site:PublicUrl}/account/orders/{number}?payment=return`.

**Адреси.** Таблиця `customers.customer_addresses`: до 10 на покупця й рівно одна основна, коли є хоч одна (перша
стає основною; `isDefault=true` переносить позначку; `isDefault=false` основну не знімає; після видалення основної
основною стає найстаріша з решти). Способи — ті самі коди, що в checkout: `nova_poshta` (населений пункт +
відділення/поштомат) і `nova_poshta_courier` (населений пункт + вулиця, будинок, квартира). Перевірка й назви — через
`IDeliveryDirectory`; назви зберігаються так само, як у замовленні (`WarehouseName` = «назва, адреса»).

**Обране.** Таблиця `catalog.favorites (customer_id, product_id, added_at)`: PK з обох колонок, FK на товар
(каскад), до 200 на покупця. Список і id повертають лише видимі товари, від нещодавно доданих.

**Таблиці** (міграція `CustomerAccounts`): `customers.customers` (унікальний `normalized_email` =
`Trim().ToUpperInvariant()`), `customers.customer_addresses`, `customers.customer_tokens` (унікальний `token_hash`,
індекс `(customer_id, purpose)`), `catalog.favorites`, колонка й індекс у `ordering.orders`. Зовнішніх ключів між
схемами різних модулів, як і раніше, немає (FK обраного на товар — усередині Catalog).

## 5.2 Права працівників

Модель узято з консолі GBA: каталог прав живе в коді, ролі зберігають набір ключів, кожен маршрут консолі вимагає
конкретне право. Ролі й права обслуговує модуль Identity, ядро перевірки лежить в `Infrastructure/Security/Permissions`.

- **Каталог** — `PermissionCatalog`: ключ `розділ.ресурс.дія`, назва й опис українською, розділ для дерева в консолі,
  ризик (low, medium, high) і версія каталогу. Константи — `PermissionKeys`; ті самі рядки має консоль.
- **Ролі** — `StaffRole` у `identity.roles`: назва для людей (унікальна), опис, ознаки системної ролі й
  суперкористувача, версія прав (concurrency token), хто й коли змінив. Права ролі — `identity.role_permissions`
  (роль, ключ), міграція `StaffRolePermissions`. У працівника одна роль.
- **Системні ролі**: `Admin` «Адміністратор» — суперкористувач, завжди має всі ключі, не редагується й не видаляється;
  `Manager` «Менеджер» — не видаляється. Поки права менеджера ніхто не змінював (версія 0), сідер під час старту API
  вирівнює їх до `PermissionCatalog.ManagerDefaults`.
- **Перевірка** — `RequireStaff(ключ, ...)` на групі або `RequirePermission(ключ, ...)` на маршруті; кілька ключів
  означають «будь-який з». `PermissionPolicyProvider` будує політику `permission:<ключі>` з імені,
  `PermissionAuthorizationHandler` бере права працівника через `IStaffAccessResolver`: роль і ключі з БД, кеш 30 с,
  який скидається одразу після зміни ролі, прав, призначення чи блокування. Заблокований працівник прав не має.
  Відмова пишеться в журнал (EventId 4601) і повертає 403 `auth.forbidden`.
- **Ендпоінти**: `GET /console/permissions/catalog`, `GET /console/permissions/me`; ролі — `GET/POST /console/roles`,
  `PUT/DELETE /console/roles/{id}`, `GET/PUT /console/roles/{id}/permissions` (повний набір ключів і
  `expectedVersion`; інша версія — 409 `roles.version_conflict`, невідомий ключ — 400 `roles.unknown_permissions`).
- **Захист від підвищення прав**: працівник без ролі адміністратора не може надати ролі право, якого не має сам
  (403 `roles.escalation`), призначити роль із такими правами чи роль адміністратора, змінити, заблокувати або скинути
  пароль працівнику із сильнішою роллю (403 `staff.escalation`). Власну роль змінити не можна (409 `auth.self_role`),
  останнього активного адміністратора не можна зняти з ролі чи заблокувати (409 `staff.last_superuser`).
- **Двофакторна перевірка (TOTP).** `AuthenticatorTokenProvider` Identity (RFC 6238, 30 с, допуск ±2 кроки), ключ і
  резервні коди — у `identity.user_tokens`, прапорець — `users.two_factor_enabled`. Свій обліковий запис:
  `GET /console/auth/two-factor` (стан, кількість резервних кодів), `POST …/setup` (новий ключ і `otpauth://`-адреса для
  QR), `POST …/enable` з кодом (10 резервних кодів), `POST …/recovery-codes` і `POST …/disable` — з поточним кодом.
  Зміна ключа чи прапорця оновлює security stamp, тож обробники перевидають cookie (`RefreshSignInAsync`).
  Вхід (`POST /console/auth/login`): пароль перевіряє `CheckPasswordSignInAsync`; з увімкненою перевіркою без
  `twoFactorCode` — 401 `auth.two_factor_required`, хибний код — 401 `auth.invalid_two_factor_code`; шість цифр
  звіряються з автентифікатором, інше — як резервний код (одноразовий). Cookie видається з `amr` = `mfa` чи `pwd`.
- **Призначення ролі адміністратора** (`IsSuperuser`) у `POST /console/users` і в `PUT /console/users/{id}` зі зміною
  ролі вимагає `twoFactorCode` того, хто призначає (`SuperuserConfirmation`): без увімкненої перевірки — 403
  `staff.two_factor_setup_required`, без коду — 403 `staff.two_factor_required`, хибний — 403 `staff.two_factor_invalid`.
  Хибні коди (і тут, і у вході, вимкненні, нових резервних кодах) рахуються як невдалі спроби Identity: п'ять поспіль
  блокують обліковий запис на 15 хв. `POST /console/users/{id}/two-factor/reset` вимикає перевірку іншому працівнику
  (власну — 409 `auth.self_two_factor`; для адміністратора — з кодом того, хто скидає). У `StaffUserDto` є
  `twoFactorEnabled`; журнал: `user.two_factor_enabled|disabled|reset`, `user.recovery_codes_generated`.
- Будь-якому працівнику доступні `/console/auth/*`, `/console/summary`, `/console/search` (групи результатів
  відсікаються за правами) і `/console/permissions/*`.

Новий ключ: константа в `PermissionKeys`, визначення в `PermissionCatalog` (за потреби — у `ManagerDefaults`), нова
`PermissionCatalog.Version`, той самий ключ у консолі. Невідомий ключ у `RequireStaff`/`RequirePermission` зупиняє
запуск API.

Версія каталогу `2026-11-06.1` (розширення консолі) додала ключі `catalog.attributes.manage`, `catalog.brands.manage`,
`catalog.labels.manage` (розділ «Каталог»), `site.home.manage`, `site.seo.manage` (новий розділ «Сайт»),
`settings.shop.manage`, `settings.notifications.manage` (новий розділ «Налаштування») і `customers.accounts.manage`.
У розділ «Сайт» переїхали `content.site.manage` («Сторінки й послуги») і `catalog.redirects.manage` («Перенаправлення
адрес (SEO)»), у «Налаштування» — `delivery.pickup.manage` («Доставка й самовивіз»). Контакти магазину
(`/console/content/contacts`) тепер вимагають `settings.shop.manage` замість `content.site.manage`. Менеджер за
замовчуванням отримав `catalog.labels.manage` (лише якщо його права ще не змінювали — див. сідер).

## 5.3 Довідники каталогу, мітки, налаштування, кабінети покупців (міграція `ConsoleCatalogSales`)

**Сховище налаштувань.** Таблиця `platform.settings` (`key` PK, `value` jsonb, `updated_at`, `updated_by`) і
`ISettingsStore` в Infrastructure: `GetAsync<T>(key)` / `SaveAsync<T>(key, value, updatedBy)`. Значення — JSON
(`JsonSerializerDefaults.Web`, перелічення рядками в camelCase). Кеш у пам'яті процесу на 30 с, скидається одразу після
збереження в тому самому процесі (Worker бачить зміну щонайпізніше за 30 с). `SaveAsync` сам викликає
`SaveChangesAsync`, тож запис аудиту робіть до нього — він збережеться разом. Ключі й записи належать модулям; той самий
JSON може читати інший модуль власним записом тієї ж форми: Catalog читає `seo.templates`
(`{ product: { title, description }, category: { title, description } }`, власник — Content) записом
`SeoTemplates.Set`. Після збереження шаблонів власник має скинути теги вітрини `catalog`, `products`, `categories`.

**Мета-шаблони.** Якщо в товару чи категорії порожні `SeoTitle`/`SeoDescription`, `GetProduct` і `GetCategory`
підставляють шаблон: `{name}`, `{price}` («1 249,50 грн»), `{category}` (для товару — його категорія, для категорії —
батьківська або вона сама), `{brand}`, `{shop}` = «Poli Valko»; зайві пробіли стискаються. Власні значення мають
пріоритет; у консолі (`ConsoleProductDto`) лишаються тільки власні.

**Характеристики** (`catalog.attribute_definitions`): назва (до 100 — як у `product_attributes.name`, щоб синхронізація
не губила назв), унікальна без урахування регістру (`normalized_name` = `Trim().ToUpperInvariant()`), одиниця (20),
`kind` `List|Number|Boolean`, `filter_view` `Checkboxes|Range` (діапазон — лише для `Number`), порядок, синоніми
`text[]` (не збігаються з іншими назвами й синонімами). Синхронізація (`CatalogDictionarySync`) створює визначення для
кожної назви з фільтрів категорій і характеристик товарів, якої немає серед назв і синонімів; запускається на старті
API, після імпорту каталогу, а `UpdateProduct` додає визначення для нових назв однією транзакцією з товаром.
Деталі (`GET /console/catalog/attributes/{id}/details`, `GetAttributeDetails`, ті самі права, що й список) повертають
`AttributeDetailsDto`: значення з кількістю різних товарів (`AttributeValueUsageDto`; назви в товарах зіставляються
через `Normalize`, значення групуються за `Trim()`, порожні відкидаються; порядок — більше товарів, потім за абеткою
`uk-UA`; до 200 штук, `valueCount` — скільки всього) і категорії, де назва є фільтром (`AttributeFilterCategoryDto`:
назва, адреса `slug`, батьківська, видимість). Синоніми в значеннях не враховуються, як і в `productCount` списку.
Перейменування (`PUT /console/catalog/attributes/{id}`) в одній транзакції переписує `product_attributes.name`
(`ExecuteUpdate`, без урахування регістру) і `categories.filter_attributes`. Видалення — 409 `attributes.in_filters`
(розширення `categoryCount`), поки назва є фільтром категорії; значення в товарах лишаються (і наступна синхронізація
поверне визначення, якщо назва ще є в товарах). Фільтри категорії приймають лише назви з довідника (інакше 400
`filterAttributes`) і зберігаються в написанні довідника. `GET /catalog/attribute-names` додає назви з довідника з
`productCount = 0`.

**Бренди** (`catalog.brands`): назва (до 200, як `products.brand`), унікальна без урахування регістру, `slug`
(унікальний, з назви), опис (2000), `logo_url`. Товар і далі зберігає `Brand` текстом (індекс `ix_products_brand`).
Перейменування й об'єднання (`POST /brands/{id}/merge { intoId }`) переписують `products.brand` через `ExecuteUpdate`
в одній транзакції; видалення — 409 `brands.in_use` (`productCount`). `UpdateProduct` і масова зміна приймають бренд
лише з довідника (400 `brand`; записується написання довідника), порожній — прибирає бренд; у `UpdateProduct` також
дозволено лишити поточний бренд товару, навіть якщо його ще немає в довіднику (до наступної синхронізації).

**Мітки** (`catalog.product_labels` + `catalog.product_label_links` (product_id, label_id), FK з каскадом на обидві
сторони): назва (30), `tone` `Green|Red|Orange|Blue|Gray|Dark`, `kind` `Manual|New|Sale`, `new_days` (для `New`,
1–365), порядок, `is_active`. Правила (`ProductLabel.AppliesTo`): `Sale` — стара ціна більша за поточну, `New` —
`CreatedAt` не старіший за `new_days`, `Manual` — є зв'язок. Показуються лише активні, за порядком. Синхронізація
створює «Акція» (Sale, червона), «Новинка» (New, 30 днів, зелена), «Хіт» (Manual, помаранчева), якщо таблиця порожня.
Тип мітки не змінюється (400 `kind`); видалити можна ручну або вимкнену автоматичну (інакше 409 `labels.auto_active`).
Товарам призначаються лише ручні мітки (400 `labelIds`/`addLabelIds`). `productCount` рахується для всіх типів
(для автоматичних — за правилом). Вітрина: `ProductListItemDto.labels` і `ProductDetailsDto.labels` (`{ name, tone }`);
консоль: `ConsoleProductListItemDto.labels` і `ConsoleProductDto.labels` (`{ id, name, tone, kind }`, діючі мітки),
`ConsoleProductDto.labelIds` (ручні, для редактора) і `createdAt`. Мітка «Новинка» у кеші вітрини оновлюється разом із
тегами товарів, тож може протриматися довше за `new_days` до наступної ревалідації.

**Категорії**: `image_url` (1000, відносна адреса медіа або https) і `description` (простий текст до 2000) — у
`ConsoleCategoryDto`/`SaveCategoryRequest` (поля необов'язкові в запиті) і на вітрині в `CategoryNodeDto` та
`CategoryDto`. Консольний список категорій повертає й приховані.

**Товари в консолі**: `GET /console/catalog/products` має ще `brand`, `labelId` (діюча мітка за її правилом), `fill`
(`missing-photo|missing-description|missing-attributes|any-missing`), `newDays`, `hiddenWithStock`;
`GET /products/counts` → `{ all, needsFilling, recent30, hiddenWithStock, outOfStock }`; `POST /products/bulk`
(до 200 товарів; `catalog.products.edit`; аудит `catalog.products_bulk_updated`) → `{ updated }` — кількість справді
змінених.

**Медіа консолі**: `POST /console/media/images` (multipart `file`) → `{ url }`, тека `content`, будь-яке з прав
`site.home.manage`, `content.site.manage`, `catalog.categories.manage`, `catalog.brands.manage`; аудит
`media.image_uploaded`. Перевірка адрес фото для збереження — `ImageUrls.IsValid`.

**Повернення**: `GET /console/refunds?q&from&to&status&page&pageSize` (`orders.page.view`) у модулі Ordering →
`PagedResponse<ConsoleRefundRowDto>` (`method` `card|offline` з `RefundMethod`, `receiptStatus` — стан останнього
чека повернення через гачок `IRefundReceiptStatuses`, який реалізує Fiscal; `null`, поки чека немає).

**Службова нотатка замовлення**: `orders.internal_note` (1000), `PUT /console/orders/{number}/note { note }`
(`orders.status.change`, аудит `order.note_changed`). Зміна пише в історію запис із `From = To` = поточний статус і
причиною «Нотатка змінена» (`OrderStatusChange.NoteChanged`); `OrderStatusChange.IsStatusChange` відсіює такі записи зі
сторінки замовлення для покупця (`OrderMapping`). `ConsoleOrderDto` має `internalNote` і `customerAccountId`.

**Кабінети покупців у консолі** (модуль Customers): `GET /console/accounts?q&status=all|confirmed|unconfirmed|locked`,
`GET /console/accounts/{id}` (адреси, кількість обраного, до 50 останніх замовлень) — `customers.page.view`;
`POST /{id}/lock { locked }` і `POST /{id}/password-reset` — `customers.accounts.manage`, аудит `customer.locked`,
`customer.unlocked`, `customer.password_reset_sent`. Блокування працівником — окрема колонка
`customers.blocked_at`: змінює security stamp (сесії завершуються), вхід із правильним паролем дає 403
`account.blocked`; відновлення пароля його не знімає, розблокування знімає й тимчасове блокування після невдалих
спроб. `lockedOut` = заблоковано працівником або діє тимчасове блокування; `blocked` у картці — лише працівником.
Кількість замовлень і замовлення беруться через гачок `ICustomerOrderHistory` (Ordering), обране — через
`ICustomerFavoritesCounter` (Catalog). Лист відновлення — той самий `AccountMail`, що й «забули пароль»; збій
відправлення — 503 `account.mail_unavailable`.

## 5.4 Сайт і налаштування магазину (міграція `ConsoleSiteSettings`)

Міграція містить лише DDL: таблицю `content.banners` (індекс `sort_order`) і колонки `content.pages.seo_title` (200),
`seo_description` (500), `content.service_directions.image_url` (1000), `content.contacts.viber` (300). Згенеровані EF
`UpdateData` для рядків `HasData` (сторінки, контакти, напрямки) прибрано, як і в `ConsoleCatalogSales`. Решта
налаштувань — JSON у `platform.settings` (розділ 5.3); кожен ключ має власника, інші модулі читають той самий JSON власним
записом. Кожне збереження з консолі пише запис аудиту до `ISettingsStore.SaveAsync` (або до `SaveChangesAsync`), тож
вони зберігаються однією транзакцією.

| Ключ | Власник | Форма | Хто ще читає |
| --- | --- | --- | --- |
| `site.home` | Content | `{ blocks: { key, visible }[], announcement: { text, link?, isActive, startsAt?, endsAt? }, perks: { title, text }[], steps: { title, text }[], visit: { title, text } }` | — |
| `seo.templates` | Content | `{ product: { title, description }, category: { title, description } }` | Catalog (`SeoTemplates`) |
| `settings.shop` | Ordering | `{ seller: { name, taxId?, address?, iban?, email?, phone? }, specialDays: { date, label, closed, hours? }[] }` | Content (`ShopSpecialDays`) |
| `settings.delivery` | Delivery | `{ novaPoshta: { enabled, cashOnDelivery }, courier: { enabled, area?, priceNote? }, pickup: { enabled } }` | — (Ordering — через `IDeliveryAvailability`) |
| `settings.notifications` | Notifications | `{ telegramChatIds: string[], emails: string[], events: { newOrder, newServiceRequest, integrationAlert, paymentAfterCancel } }` | — |

**Початкові дані.** `ContentModule.SeedSiteAsync` запускається на кожному старті API (і в `ApiFactory` тестів) та
заповнює лише порожнє: якщо ключа `site.home` ще немає — зберігає тексти головної, які раніше були зашиті у вітрину
(блоки в теперішньому порядку `hero, offers, collections, categories, perks, services, steps, visit`, переваги, кроки,
блок магазину; оголошення порожнє й вимкнене), а якщо до того ж таблиця банерів порожня — два банери з колишніх слайдів
вітрини (`hero-slides.ts`). Наявність `site.home` — ознака, що сід уже був: якщо працівник видалить усі банери, вони не
повернуться. Якщо ключа `seo.templates` немає — зберігає типові шаблони без назви магазину (вітрина сама додає
« | Poli Valko» до заголовка): товар — `{name} — купити в Бучі, ціна {price}` /
`{name} у магазині Poli Valko: ціна {price}, доставка Новою поштою й самовивіз у Бучі.`, категорія —
`{name} — купити в Бучі` / `{name}: ціни, наявність і доставка по Україні.` Збережене працівником не перезаписується.

**Головна й банери** (Content, `site.home.manage`). `GET/PUT /console/site/home` — `HomeSettingsDto`: невідомий чи
повторений блок — 400 `blocks`; блоки, яких немає в запиті, додаються в кінець видимими. Оголошення — до 160 символів,
увімкнене потребує тексту, посилання — відносне `/…` (не `//`) або `http(s)://` до 300 символів, `endsAt` не раніше за
`startsAt`; переваги й кроки — до 6, заголовок обов'язковий (до 80), текст до 300; блок магазину — заголовок до 80,
текст до 200. Ключі помилок: `announcement.text`, `perks[0].title` тощо. Банери: `GET/POST /console/site/banners`
(новий — останнім, 201), `PUT/DELETE /console/site/banners/{id}` (404 `content.banner_not_found`, видалення — 204),
`PUT /console/site/banners/order { ids }` — усі id рівно один раз (інакше 400 `ids`), відповідь — список у новому порядку.
Поля банера: надпис над заголовком `kicker` (40, необов'язковий; колонка `content.banners.kicker` з міграції
`BannerKicker`, яка проставила надписи двом засіяним банерам за їхніми заголовками; є в консольному DTO, запиті й
публічному `HomeBannerDto`), заголовок (80, обов'язковий), текст (200), напис на кнопці (30), посилання (300, як в оголошенні), фото
(обов'язкове) і фото для телефона — `ImageUrls.IsValid`, `startsAt`/`endsAt` (`DateTimeOffset`, консоль надсилає
початок і кінець дня за місцевим часом), `isActive`. Аудит `site.home_updated`, `site.banner_created|updated|deleted`,
`site.banners_reordered`; після змін скидаються теги вітрини `content`, `site`, `home`.

**Публічна головна.** `GET /api/v1/site/home` → `SiteHomeDto { announcement?, blocks, perks, steps, visit, banners }`:
оголошення — лише коли увімкнене, має текст і зараз у межах періоду; банери — увімкнені, у яких зараз у межах періоду, за
`sort_order`. Увімкнені банери кешуються в пам'яті процесу на 1 хв (ключ `content:banners:active`, скидається після
зміни банерів), налаштування — кешем `ISettingsStore` (30 с); період перевіряється на кожен запит.

**Сторінки й послуги** (`content.site.manage`). `PageDto`, `ConsolePageListItemDto` і `SavePageRequest` мають `seoTitle`
(до 200) і `seoDescription` (до 500); на вітрині — у `GET /pages/{slug}`. Напрямки послуг мають `imageUrl`
(`ImageUrls.IsValid`): у `ConsoleServiceDirectionDto`, `SaveServiceDirectionRequest` (необов'язкове поле) і в публічному
`ServiceDirectionDto`.

**Мета-шаблони** (`site.seo.manage`). `GET/PUT /console/site/seo-templates` — `SeoTemplatesDto`; заголовки обов'язкові,
кожен шаблон до 300 символів; змінні товару — `{name}`, `{price}`, `{category}`, `{brand}`, `{shop}`, категорії — `{name}`,
`{category}`, `{shop}` (інші — 400 «Невідомі змінні»). Аудит `site.seo_templates_updated`; скидаються теги `catalog`,
`products`, `categories`. Застосовує шаблони Catalog (розділ 5.3).

**Магазин** (Ordering, `settings.shop.manage`). `GET/PUT /console/settings/shop` — `ShopSettingsDto { seller,
specialDays }`. Поки реквізити не збережено, `seller` береться з `SellerOptions` (`Seller:*`). Перевірки: назва
обов'язкова (до 200), ЄДРПОУ/РНОКПП — 8 або 10 цифр (пробіли прибираються), IBAN — `UA` і 27 цифр (пробіли прибираються,
великі літери), email, телефон до 30; особливі дні — до 100, дата (`yyyy-MM-dd`) не повторюється, назва до 60, години
обов'язкові для робочого дня (до 60), для вихідного не зберігаються; список сортується за датою. Аудит
`settings.shop_updated`, тег вітрини `content`. Збережені реквізити віддає `GET /api/v1/seller` (`SellerDto` + `iban`,
`email`, `phone`) і записує в нові замовлення (`SellerName`, `SellerTaxId`). Соцмережі живуть лише в контактах
(`/console/content/contacts`, той самий `settings.shop.manage`): `ContactsDto` має `viber` (`viber://` або `http(s)://`)
і `specialDays` — у відповідях лише сьогоднішні й майбутні дні з `settings.shop` за київським часом, у запиті поле
ігнорується.

**Доставка** (Delivery, `delivery.pickup.manage`). `GET/PUT /console/settings/delivery` — `DeliverySettingsDto`; типово все
увімкнено. Усі способи вимкнені — 400 `delivery.no_methods`; зона й примітка кур'єра — до 200 (`courier.area`,
`courier.priceNote`). Аудит `delivery.settings_updated`, тег `delivery`. `IDeliveryAvailability` віддає checkout, що
зараз дозволено: Нова пошта й кур'єр — за перемикачами, післяплата — для обох способів Нової пошти, самовивіз — лише
коли він увімкнений **і** є активна точка (`PickupPointStore`). `QuoteCheckout` показує тільки ці способи
(`DeliveryMethodOptionDto` має ще `description` — зона кур'єра — і `priceNote`), `CreateOrder` відхиляє інші
(400 `delivery.method` / `payment.method`). Колишнє `IDeliveryDirectory.GetPickupAsync` кидало виняток, коли активних
точок не було (500 під час замовлення із самовивозом), — його прибрано разом із `PickupPointStore.GetDefaultAsync`.
Останню активну точку можна вимкнути лише тоді, коли самовивіз вимкнений у налаштуваннях.

**Оплата й чеки** (модуль Console, `integration.status.view`, лише читання). `GET /console/settings/payments` →
`PaymentSettingsDto`: `provider` `Sandbox|Mono|None` і `mode` `Test|Live|Disabled` (`IPaymentSettings` з
`Payments:Provider`), `lastReconcileAt` — останній успіх завдання `payments.reconcile`, `fiscalProvider`
`Checkbox|Stub|Disabled` і `fiscalMode` `Live|Stub|Disabled` (`IFiscalSettings` з `Fiscal:Provider`), `issueOn { card,
cashOnDelivery, pickup }` — `payment|completion|none` з `Fiscal:IssueOn` (усі `none`, коли ПРРО вимкнено).

**Сповіщення** (Notifications, `settings.notifications.manage`). `GET/PUT /console/settings/notifications` —
`NotificationSettingsDto { telegramChatIds, emails, events, telegramConfigured }` (запит — `SaveNotificationSettingsRequest`
без `telegramConfigured`). ID чату — число від 5 до 20 цифр (можна з мінусом) або `@назва`; до 10 чатів і 10 адрес,
дублікати прибираються, адреси — малими літерами. `POST /console/settings/notifications/test` надсилає «Тестове
повідомлення» в усі чати → `{ chats, delivered }`; без бота — 409 `notifications.telegram_not_configured`, без чатів — 409
`notifications.no_recipients`, Telegram не прийняв жодного — 502 `notifications.send_failed`. Аудит
`settings.notifications_updated`, `settings.notifications_test_sent`. Доставка: `IManagerNotifier` тепер реалізує
`ManagerNotifier` — він перевіряє перемикач події (`ManagerEvent`: нове замовлення й оплата → `newOrder`, заявка →
`newServiceRequest`, тривога інтеграції → `integrationAlert`, оплата скасованого замовлення → `paymentAfterCancel`,
тест — завжди), бере чати з налаштувань (порожньо — `Notifications:Telegram:ChatId`) і передає повідомлення каналу
`IManagerChannel`: `TelegramManagerNotifier`, коли задано `Notifications:Telegram:BotToken` (типізований HttpClient з
колишнім ім'ям `IManagerNotifier`), інакше `LogManagerNotifier`. Telegram надсилає в кожен чат окремо; якщо не прийняв
жоден, обробник outbox падає й повторюється. Адреси e-mail поки лише зберігаються: листи менеджерам з'являться разом із
поштовим провайдером. Оплата скасованого замовлення тепер іде окремим повідомленням outbox `OrderPaidAfterCancel`
(`ordering.paid-after-cancel`, обробник `NotifyManagerOnOrderPaidAfterCancel`) замість `IntegrationAlert`, щоб її
можна було вимкнути окремо.

## 6. Інваріанти

### 6.1 OpenAPI — байт у байт

- Документ генерує `Microsoft.Extensions.ApiDescription.Server` під час збірки `PoliValko.Api` у
  `openapi/polivalko-api.json`. Перевірка: `git diff --exit-code -- openapi/` порожній. Руками не редагувати.
  Коли API розширюється (як кабінетом покупця), наявні операції й схеми лишаються байт у байт, а нові лише додаються:
  `git diff --diff-algorithm=patience --numstat -- openapi/` показує 0 видалених рядків (звичайний diff через
  алфавітний порядок схем може показувати «зсунуті» шматки).
- Порядок шляхів = порядок мапінгу (розділ 4) і порядок `Map*` усередині груп.
- Імена схем = короткі імена CLR-типів (`ConsoleDashboardDto`, `PagedResponseOfAuditEntryDto`, `SyncError`, ...).
  Простір імен і збірка типу на документ не впливають, але **ім'я, generic-форма й вкладеність** — впливають.
  Порядок властивостей у схемі = порядок параметрів записів.
- Метадані операцій: `WithName`, `WithSummary`, `WithTags`, порядок і набір `ProducesProblem`, `RequireStaff` (додає 401/403),
  `RequireIdempotency<T>` (заголовок `Idempotency-Key`), `WithEnumQuery<T>` (посилання на схему за `typeof(T).Name`),
  `[AsParameters]`-записи з `[FromQuery(Name=…)]` і `[Description]`, імена, порядок, типи й nullability параметрів
  обробників, generic-аргументи `Results<…>` у тому самому порядку.
- `GenerateDocumentationFile=false` у `Directory.Build.props`: XML-коментарі в документ не потрапляють, тож їх
  видалення OpenAPI не змінює. Цю властивість не вмикати.

### 6.2 Модель EF Core — зміни лише новою міграцією

- Один `PoliValkoDbContext` (`IdentityDbContext<StaffUser, IdentityRole, string>`) і міграції в
  `src/PoliValko.Infrastructure/Persistence/Migrations` (`Initial`, `Prototype`, `LaunchScope`, `CustomerAccounts`,
  `StaffRolePermissions`, `ConsoleCatalogSales`, `ConsoleSiteSettings`, `BannerKicker`, `CatalogSearchIndexes` і snapshot) — наявні файли міграцій не чіпати; рефакторинг модель
  не змінює, нова функціональність — нова міграція. У `ConsoleCatalogSales` прибрано згенеровані EF `UpdateData` для
  рядків `HasData` категорій (вони ставили `NULL` у щойно додані колонки) — міграція містить лише DDL. Так само в
  `ConsoleSiteSettings` (сторінки, контакти, напрямки послуг).
- Модель: `IdentityModel.MoveToSchema`, розширення `pg_trgm`, `ApplyConfigurationsFromAssembly` збірки
  Infrastructure (конфігурації outbox, idempotency, audit, sync лишаються в цій збірці), потім `IModelConfigurator`
  у порядку реєстрації (Catalog, Content, Delivery, Ordering, Payments, Fiscal, Customers), `UseSnakeCaseNamingConvention`,
  таблиця історії `integration.__ef_migrations_history`, схеми з `Schemas` (зокрема `customers` і `platform`).
- Пошук товарів спирається на GIN-індекси `gin_trgm_ops` на `products.name`, `products.slug` і `products.brand`
  (`ix_products_name`, `ix_products_slug_trgm`, `ix_products_brand_trgm`): ними користуються `ILIKE` і оператор
  схожості `<%`. Поріг схожості `pg_trgm.word_similarity_threshold` = `TrigramSearch.WordSimilarityThreshold` (0,5)
  `PlatformModule` додає до рядка підключення як `Options=-c …`, тож він діє в кожному сеансі без окремого `SET`.
  Нечіткий пошук (`ProductSearchText.Similar`) відбирає товари через `id IN (… <% name UNION ALL … <% slug)`, а не
  через `OR`: з `OR` планувальник недооцінює вартість `<%` і читає всю таблицю (на 10 000 товарах — 550 мс замість 40 мс).
- Фасети списку товарів (`ProductFacetBuilder`: бренди, мін./макс. ціна, кількість у наявності, характеристики)
  рахуються за областю — розділ, пошук і (з 09.11) `onSale` — до фільтрів бренду, наявності, ціни й характеристик.
  Тож на сторінці «Акції» лічильники описують лише товари зі знижкою, а вибраний бренд не ховає інші бренди.
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
  `ordering.fiscal-receipt-requested`, `ordering.refund-requested`, `ordering.paid-after-cancel`,
  `content.service-request-submitted`, `integration.alert`. Payload — `System.Text.Json` з `JsonSerializerDefaults.Web`: імена властивостей записів
  (camelCase) і числові значення `FiscalTrigger` (`Payment=0`, `Completion=1`, `Refund=2`) не змінюються.
  CLR-простір імен повідомлень змінювати можна.
- **Завдання синхронізації** (`sync_states.job`, `sync_runs.job`): `navkolo.price-stock`, `navkolo.catalog`,
  `navkolo.import`, `novaposhta.directory`, `payments.reconcile`; виконавці (`sync_runs.started_by`) `Розклад`,
  `Запит з адмінки` — збережене значення, тому під час перейменування на «консоль» лишилося як було.
- **Перелічення, що зберігаються рядком** (`HasConversion<string>()`) або видні в OpenAPI: імена членів
  `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `DeliveryMethod`, `RefundMethod`, `RefundStatus`,
  `PaymentAttemptStatus`, `ReceiptKind`, `ReceiptStatus`, `WarehouseType`, `OutboxStatus`, `SyncRunStatus`,
  `ServiceRequestStatus`, `CustomerTokenPurpose`, `AttributeKind`, `AttributeFilterView`, `LabelKind`, `LabelTone`,
  `RefundChannel`; `payment_events.state` = `ProviderPaymentState.ToString()`. Ключі `platform.settings`
  (`seo.templates`, `site.home`, `settings.shop`, `settings.delivery`, `settings.notifications`; розділ 5.4) і форма їхнього
  JSON — теж збережені ідентичності.
  Код способу доставки збереженої адреси (`customer_addresses.delivery_method`) — рядки `DeliveryCodes`
  (`nova_poshta`, `nova_poshta_courier`).
- Рядкові літерали дій і типів аудиту (`order.status_changed`, `integration.outbox_retried`, `SyncJob`, `CatalogImport`, …),
  коди проблем (`catalog.product_not_found`, …), тексти помилок валідації.
- `idempotency_keys.scope` = `"{METHOD} {шаблон маршруту}"` — шаблони маршрутів і префікси груп не змінюються.
  `subject_hash` прив’язує повтор до автентифікованих типу identity та ID; чужий subject або legacy NULL відхиляються з 409.
  Єдиний виняток для шаблону scope — перейменування групи консолі 04.11.2026: записи з попереднім префіксом просто спливли за 72 год.
- Data Protection: `SetApplicationName("PoliValko")`, ключі в `identity.data_protection_keys`; cookie `pv_console`
  (перейменована 04.11.2026: наявні тоді сесії працівників завершилися), `pv_customer`, `pv_csrf`; заголовок
  `X-CSRF-TOKEN`; схеми `Identity.Application`, `Customer`, `PoliValko` (типова, вибір за шляхом); claim
  `customer_stamp`. Key ring шифрується RSA-сертифікатом поза БД; старт API перепаковує legacy XML без зміни ID/матеріалу ключів (див. operations.md).
  Зміна імені схеми `Customer` чи типу claim робить недійсними cookie покупців.
- Вбудований ресурс `demo-catalog.json` шукається за суфіксом імені; якщо файл переїжджає, шлях у
  `<EmbeddedResource>` у `PoliValko.Catalog.csproj` переїжджає разом із ним.
- Ключі кешу `delivery:pickup-points:active`, `content:banners:active`, теги ревалідації вітрини (`StorefrontTags`, зокрема
  `site` і `home` для головної), структура URL медіа.
- Імена типізованих HttpClient = короткі імена класів (`NovaPoshtaClient`, `MonoPaymentProvider`,
  `CheckboxFiscalProvider`, `IManagerNotifier`, `IStorefrontCache`) — ці класи не перейменовуються.
- Категорії логерів (повне ім'я типу) змінюються разом із просторами імен — це прийнятно: жодне налаштування на них
  не спирається.

### 6.4 Налаштування

Секції, ключі й спосіб зв'язування не змінюються (умовні реєстрації читають секцію під час реєстрації, решта —
через `IOptions`):

`ConnectionStrings:PoliValko`; `Outbox` (BatchSize, MaxAttempts, LockDuration, PollInterval); `Sync`
(AlertAfterFailures); `Media` (Root, PublicPath, MaxUploadBytes); `Site:PublicUrl`; `Web` (RevalidateUrl,
RevalidateSecret); `Catalog:HiddenNavkoloGroups`; `Seller` (Name, TaxId, Address — лише поки реквізити не збережено в
консолі); `Delivery:NovaPoshta` (ApiKey, BaseUrl, SyncInterval, PageSize, PageDelay, MaxRetries, RetryDelay, Timeout);
`Payments` (Provider, InvoiceValidity, Sandbox:Secret, Mono:BaseUrl, Mono:Token); `Fiscal` (Provider, IssueOn,
PaymentTypes, Checkbox:*); `Navkolo` (Mode, SyncInterval, CatalogInterval, FreshnessThreshold, Stub:SimulateOutage);
`Notifications:Telegram` (BotToken; ChatId — запасний чат, коли в консолі чатів не вказано);
`RateLimiting:{Forms,Orders,Login}:{PermitLimit,WindowSeconds}` (типово 5/60, 10/600, 10/60);
`Cors:Origins`; `Api:ExposeDocs`; `Database:ApplyMigrationsOnStartup`, `Database:SeedDemoData`; `Seed:Users`;
`Email:Mode` (`Log` — типово й поки єдине значення, інше зупиняє запуск). `Site:PublicUrl` тепер також база посилань у листах покупцю й адреси повернення з оплати в кабінеті.

### 6.5 HTTP-політики

- Авторизація працівників: політика `staff` (будь-який працівник із cookie `pv_console`) і політики
  `permission:<ключ>` з каталогу прав (розділ 5.2); cookie Identity (HttpOnly, SameSite=Strict,
  8 год, sliding), блокування після 5 спроб на 15 хв (хибні коди двофакторної перевірки теж рахуються), пароль від
  10 символів, необов'язкова двофакторна перевірка TOTP (обов'язкова, щоб призначати роль адміністратора), перевірка
  security stamp щохвилини,
  відповіді 401/403 у форматі Problem Details.
- Покупці: політика `customer`, cookie `pv_customer` (HttpOnly, SameSite=Lax, 30 днів, sliding), блокування після
  5 спроб на 15 хв, пароль 8–128 символів, перевірка security stamp на кожному запиті; типова схема
  обирає cookie за шляхом (розділ 5.1).
- Rate limiting: політики `forms`, `orders`, `login` (фіксоване вікно на IP), 429 із `Retry-After` і Problem Details
  «Забагато запитів». Імена політик — `RateLimitPolicies` в Infrastructure. Кабінет: `forms` — реєстрація, «забули
  пароль», повторний лист; `login` — вхід, підтвердження email, відновлення й зміна пароля.
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
- Повідомлення менеджеру: канал Telegram, якщо задано BotToken (чати — з налаштувань сповіщень, запасний — ChatId),
  інакше лог; перемикачі подій — у налаштуваннях сповіщень (розділ 5.4).
- Листи покупцю (`ICustomerMailer`): `Email:Mode` = `Log` — заглушка `LogCustomerMailer` пише в лог адресата й
  посилання з токеном. Для продакшну потрібен справжній провайдер (новий режим і реалізація в
  `Notifications/Integrations`), бо посилання в лозі — це робочі токени входу в обліковий запис.

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
- **ModuleLayoutTests** (усі модулі зі списку `SolutionAssemblies.Modules`, через рефлексію; типи, які згенерував компілятор, — імена з `<`,
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
3. Додайте `Map*` у `<Область>Endpoints.Map` у потрібне місце; маршрути консолі — у групі з `RequireStaff(ключ)`
   або з `RequirePermission(ключ)` на маршруті (розділ 5.2).
4. Зберіть рішення: оновлений `openapi/polivalko-api.json` комітиться разом зі змінами, а веб перегенеровує типи.
5. Тест — у `tests/PoliValko.IntegrationTests/<Модуль>/`.

### Маршрут особистого кабінету в модулі

1. Модуль посилається на `PoliValko.Customers` (лише `Contracts`): група `api.MapGroup("/account/...")`,
   `.WithTags("Account").RequireCustomer()` — політика `customer`, CSRF для змін і 401 у документі.
2. Id покупця — `http.User.CustomerId()`; чужі записи віддавайте як 404, а не 403.
3. Функцію `MapAccount<Область>Endpoints` додайте в кінець `ApiEndpoints` (після блоків кабінету), тест — у
   `tests/PoliValko.IntegrationTests/<Модуль>/` з помічником `Accounts`.

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


## Серверний кошик, оформлення й резерви (08.11.2026)

Міграція `ServerCartsAndReservations` додає `ordering.carts`, `catalog.stock_reservations`
і `catalog.product_stock.reserved_quantity`. Кошик гостя ідентифікує випадкова HttpOnly cookie
`pv_cart` (90 днів, SameSite=Lax, Secure на HTTPS); у БД зберігається хеш ідентифікатора.
Кошик покупця прив'язаний до автентифікованого customer ID. Після входу гостьові кількості додаються
до акаунта один раз; після виходу дані акаунта не доступні через гостьову cookie.

Усі операції кошика мають CSRF, ліміт запитів і перевірку ревізії. Advisory lock серіалізує записи
одного власника, UUID кошика не є авторизацією. `OrderWriter` спільний для прямого API та серверного кошика.
Оформлення блокує рядки залишків у сталому порядку, перевіряє ціни й доступність, записує замовлення,
резерви, outbox, очищення кошика та зашифрований Data Protection результат однією транзакцією.
Результат попередньої ревізії відновлюється після втрати відповіді або перезавантаження;
він не залежить від TTL загального кешу Idempotency-Key. Нове оформлення потребує нової ревізії кошика.

Кошик сам по собі не резервує товар. Резерв виникає після успішного оформлення, включно з
`AwaitingConfirmation`; перевірка доступності віднімає його і на вітрині, і в quote, і при checkout.
До першої спроби передачі скасування звільняє резерв один раз одразу. Для переданих замовлень або невідомого результату передачі резерв тримається до підтвердження скасування Навколо. Після `Shipped`/`Completed` він позначений спожитим:
скасування чи повернення коштів не означають фізичного повернення товару. Спожитий резерв утримується
до підтвердження відвантаження в ERP і синхронізації залишку. Автоматичного таймера скасування/звільнення
неоплачених замовлень немає: працівник скасовує їх у консолі, тому пізня оплата не втрачає вже проданий резерв.
При вимкненій ERP або Stub виконані замовлення продовжують зменшувати доступність локально.


### Скасування Навколо (08.11.2026)

`OrderCancellationRequested` записується разом зі статусом `Cancelled`. `NavkoloExportAttemptedAt` фіксується
окремим атомарним UPDATE до мережевого запиту лише для нескасованого замовлення. Це дозволяє відрізнити
«ніколи не передавали» від «передали, але втратили відповідь». Для одного UUID експорт і скасування працюють
під PostgreSQL session advisory lock; блокування звільняється в finally, закриття процесу також звільняє його.
Скасування в консолі не чекає HTTP-відповіді ERP. Підтвердження в ERP, ідемпотентне звільнення неспожитого
резерву та відмітка `NavkoloCancellationSynchronizedAt` завершують обробку; останні дві дії — одна транзакція.
Вичерпання повторів не звільняє резерв автоматично. Журнал/ручний повтор доступні через outbox консолі.


### Зворотна синхронізація Навколо (08.11.2026)

`NavkoloInventorySync` виконує зворотну звірку всередині `navkolo.price-stock`. Навколо передає нормалізовані
`ExternalOrderState` через порт `IOrderStateSync`; лише Ordering змінює замовлення/історію, лише Catalog змінює резерви.
Порядок блокувань: inventory advisory lock → advisory locks UUID (ті самі ключі, що outbound) → рядки замовлень
у порядку UUID → рядки залишків. Після отримання блокувань статуси перечитуються; нові UUID поза блокуванням
чекають наступного циклу. Це не дозволяє пізньому upload перезаписати вже прийняте скасування.

Імпорт залишків, `NavkoloShippedAt`/`NavkoloCancelledAt`, статус, історія, аудит і звільнення резервів комітяться разом.
Відсутні товари у свіжому знімку відвантаження спричиняють rollback. Втрачену відповідь upload можна підтвердити
наявним UUID документа; повторного upload після цього немає. Зворотна звірка не генерує подій outbound-скасування.

DNTrade не надає версії статусу в документі; факти terminal-станів накопичуються, а не стираються. `load=1`
має пріоритет для складського обліку. Конфлікт скасування/відвантаження видно в історії та картці; фінансові
статуси не змінюються й повернення коштів автоматично не виконується. API не гарантує атомарного знімка
між сторінками замовлень і товарів; дубльовані UUID відхиляються, подальші зміни ERP підхоплює наступний цикл.
