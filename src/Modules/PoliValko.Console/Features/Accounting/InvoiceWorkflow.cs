using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Accounting;

public sealed record StockImpact(Guid ProductId, string Title, decimal Before, decimal Change, decimal After,
    decimal? ReservedQuantity = null, bool FirstMovement = false, bool UnlinkedFromShop = false);
public sealed record InvoicePayment(Guid Id, DateOnly Day,
    [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)] decimal Amount,
    string Method, string AccountTitle, string Reference);
public sealed record RecordedPayment(Guid Id, DateOnly Day, string Amount, string Method, string AccountTitle, string Reference);
public sealed record InvoiceOfferReservation(decimal Quantity, string Unit);
public sealed record InvoiceState(string Status, Guid OrgId, Guid StoreId, string Store, string Revision, string Total, string Paid, string? Due,
    List<StockImpact> Stock, List<RecordedPayment> Payments, InvoiceOfferReservation? OfferReservation);
public sealed record WorkCounts(int Drafts, int Receivable, int Payable, int Settled);
public sealed record PostInvoice(string Revision, bool LinkUnlinkedToShop = false);
public sealed record WarehouseBalance(Guid OrgId, Guid StoreId, string Organization, string Store, Guid ProductId, string Product, string Sku, decimal Quantity, decimal Opening,
    decimal? ShopQuantity, decimal? Reserved, Guid? SourceOrgId, Guid? SourceStoreId, string? SourceOrganization, string? SourceStore, bool Visible);
public sealed record StockOpening(Guid Id, Guid OrgId, Guid StoreId, Guid ProductId, decimal Quantity, DateOnly Day, string Reference);
public sealed record PartnerPosition(string Organization, string Currency, string Receivable, string Payable);
internal sealed record NativeInvoice(Guid Id, string Status, string Kind, DateOnly Day, decimal Total, Guid OrgId, Guid StoreId);
internal sealed record PaymentTarget(Guid Id, Guid? DocumentId, Guid? OpeningId, DateOnly Day, decimal Amount,
    string Method, string AccountTitle, string Reference);

internal static class InvoiceWorkflow
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/work", Counts).WithName("ConsoleAccountingWork");
        group.MapGet("/warehouse", Warehouse).WithName("ConsoleAccountingWarehouse").Produces<RegisterPage<WarehouseBalance>>();
        group.MapPost("/warehouse/openings", OpenStock).WithName("ConsoleAccountingOpenStock")
            .RequirePermission(PermissionKeys.AccountingOpening).Produces<Guid>();
        group.MapPut("/warehouse/shop-source/{id:guid}", ShopStockSource.Connect).WithName("ConsoleConnectShopStock")
            .RequirePermission(PermissionKeys.CatalogImportRun).Produces<Guid>();
        group.MapPost("/warehouse/shop-source/bulk", ShopStockSource.ConnectBulk).WithName("ConsoleConnectShopStockBulk")
            .RequirePermission(PermissionKeys.CatalogImportRun).Produces<BulkWarehouseConnection>();
        group.MapDelete("/warehouse/shop-source/{id:guid}", ShopStockSource.Disconnect).WithName("ConsoleDisconnectShopStock")
            .RequirePermission(PermissionKeys.CatalogImportRun).Produces<Guid>();
        group.MapGet("/warehouse/default-shop-source", ShopStockSource.GetDefaultWarehouse).WithName("ConsoleGetDefaultShopWarehouse")
            .Produces<DefaultWarehouseSetting?>();
        group.MapPut("/warehouse/default-shop-source", ShopStockSource.SetDefaultWarehouse).WithName("ConsoleSetDefaultShopWarehouse")
            .RequirePermission(PermissionKeys.CatalogImportRun).Produces<Guid>();
        group.MapPost("/warehouse/initialize-from-catalog", ShopStockSource.InitializeFromCatalog).WithName("ConsoleInitializeWarehouseFromCatalog")
            .RequirePermission(PermissionKeys.AccountingOpening).Produces<CatalogWarehouseInitResult>();
        group.MapGet("/warehouse/{id:guid}/movements", ShopStockSource.Movements).WithName("ConsoleWarehouseMovements")
            .Produces<RegisterPage<WarehouseMovement>>();
        group.MapGet("/partners/{id:guid}/positions", Positions).WithName("ConsoleAccountingPartnerPositions");
        group.MapGet("/documents/{id:guid}/operations", State).WithName("ConsoleInvoiceState").Produces<InvoiceState>();
        group.MapPost("/documents/{id:guid}/post", Post).WithName("ConsolePostInvoice")
            .RequirePermission(PermissionKeys.AccountingPost).Produces<Guid>();
        group.MapPost("/documents/{id:guid}/unpost", Unpost).WithName("ConsoleUnpostInvoice")
            .RequirePermission(PermissionKeys.AccountingPost).Produces<Guid>();
        group.MapPost("/documents/{id:guid}/payments", Pay).WithName("ConsoleRecordInvoicePayment")
            .RequirePermission(PermissionKeys.AccountingPay).Produces<Guid>();
        group.MapDelete("/payments/{id:guid}", DeletePayment).WithName("ConsoleDeleteInvoicePayment")
            .RequirePermission(PermissionKeys.AccountingPost).Produces<Guid>();
    }

    private static Task<WorkCounts> Counts(PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<WorkCounts>($"""
            SELECT count(*) FILTER (WHERE status='draft')::int AS drafts,
                count(*) FILTER (WHERE kind='out' AND due>0)::int AS receivable,
                count(*) FILTER (WHERE kind IN ('in','customerReturn') AND due>0)::int AS payable,
                count(*) FILTER (WHERE due=0)::int AS settled FROM accounting.invoice_operations
            """).SingleAsync(ct);

    private static Task<List<PartnerPosition>> Positions(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<PartnerPosition>($"""
            SELECT org.title AS organization,d.currency,d.receivable::text,d.payable::text
            FROM accounting.current_partner_balances d JOIN accounting.references org ON org.id=d.org_id
            WHERE d.partner_id={id} ORDER BY org.title,d.currency,org.id
            """).ToListAsync(ct);

    private static async Task<IResult> Warehouse(PoliValkoDbContext db, string? q, Guid? store, int page = 1, CancellationToken ct = default)
    {
        if (page is < 1 or > 1_000_000 || q is { Length: > 160 }) return Results.BadRequest();
        var term = q?.Trim().ToLowerInvariant() ?? "";
        var rows = db.Database.SqlQuery<WarehouseBalance>($"""
            SELECT w.org_id,w.store_id,org.title AS organization,s.title AS store,p.id AS product_id,coalesce(nullif(p.display_name,''),p.name) AS product,p.sku,w.quantity,
                coalesce(o.quantity,0) AS opening,c.quantity AS shop_quantity,c.reserved_quantity AS reserved,
                c.warehouse_org_id AS source_org_id,c.warehouse_store_id AS source_store_id,
                so.title AS source_organization,ss.title AS source_store,p.is_visible AS visible
            FROM accounting.warehouse_stock w JOIN catalog.products p ON p.id=w.product_id
            JOIN accounting.references org ON org.id=w.org_id JOIN accounting.references s ON s.id=w.store_id
            LEFT JOIN accounting.stock_openings o USING(org_id,store_id,product_id)
            LEFT JOIN catalog.product_stock c ON c.product_id=w.product_id
            LEFT JOIN accounting.references so ON so.id=c.warehouse_org_id
            LEFT JOIN accounting.references ss ON ss.id=c.warehouse_store_id
            WHERE ({store}::uuid IS NULL OR w.store_id={store}::uuid)
                AND (strpos(lower(p.name),{term})>0 OR strpos(lower(coalesce(p.display_name,'')),{term})>0 OR strpos(lower(p.sku),{term})>0)
            ORDER BY coalesce(nullif(p.display_name,''),p.name),w.product_id,w.org_id,w.store_id
            """);
        return Results.Ok(new RegisterPage<WarehouseBalance>(await rows.Skip((page - 1) * 50).Take(50).ToListAsync(ct), await rows.CountAsync(ct)));
    }

    private static async Task<IResult> OpenStock(StockOpening input, PoliValkoDbContext db, IOutbox outbox, IAuditLog audit, CancellationToken ct)
    {
        if (input.Id == Guid.Empty || input.Day == default || input.Quantity is < 0 or > 1000000000 ||
            decimal.Round(input.Quantity, 3) != input.Quantity || string.IsNullOrWhiteSpace(input.Reference) || input.Reference.Length > 150)
            return Results.BadRequest(new { title = "Вкажіть звірену кількість, дату і документ-підставу." });
        input = input with { Reference = input.Reference.Trim() };
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var inserted = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.warehouse_stock(org_id,store_id,product_id,quantity)
            SELECT o.id,s.id,p.id,{input.Quantity} FROM accounting.references o,accounting.references s,catalog.products p
            WHERE o.id={input.OrgId} AND o.kind='organization' AND s.id={input.StoreId} AND s.kind='store' AND p.id={input.ProductId} AND NOT p.is_archived
            ON CONFLICT DO NOTHING
            """, ct);
        if (inserted == 0)
        {
            var saved = await db.Database.SqlQuery<StockOpening>($"""
                SELECT id,org_id,store_id,product_id,quantity,day,reference FROM accounting.stock_openings WHERE id={input.Id}
                """).SingleOrDefaultAsync(ct);
            if (saved == input) return Results.Ok(input.Id);
            var archived = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value" FROM catalog.products WHERE id={input.ProductId} AND is_archived
                """).AnyAsync(ct);
            if (archived) return Conflict("Архівний товар не можна ставити на склад. Спочатку відновіть його з архіву.");
            // Auto-linked new products start with an untouched zero warehouse_stock row; allow opening stock before any movement.
            var updatedZero = await db.Database.ExecuteSqlAsync($"""
                UPDATE accounting.warehouse_stock w
                SET quantity={input.Quantity}
                WHERE w.org_id={input.OrgId} AND w.store_id={input.StoreId} AND w.product_id={input.ProductId}
                  AND w.quantity=0
                  AND NOT EXISTS (
                      SELECT 1 FROM accounting.stock_openings o
                      WHERE o.org_id=w.org_id AND o.store_id=w.store_id AND o.product_id=w.product_id
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM accounting.stock_movements m
                      JOIN accounting.documents d ON d.id=m.document_id
                      WHERE d.native_org_id=w.org_id AND m.store_id=w.store_id AND m.product_id=w.product_id
                  )
                """, ct);
            if (updatedZero == 0)
                return Conflict("Перевірте реквізити. Початковий залишок можна ввести лише до першого руху цього товару в організації та на складі.");
        }
        var recorded = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.stock_openings VALUES({input.Id},{input.OrgId},{input.StoreId},{input.ProductId},{input.Quantity},{input.Day},{input.Reference})
            ON CONFLICT(id) DO NOTHING
            """, ct);
        if (recorded == 0) return Conflict("Цей код документа вже використано.");
        var synced = await db.Database.ExecuteSqlAsync($"""
            UPDATE catalog.product_stock c SET quantity=w.quantity,updated_at=now()
            FROM accounting.warehouse_stock w
            WHERE (c.product_id,c.warehouse_org_id,c.warehouse_store_id)=(w.product_id,w.org_id,w.store_id)
              AND w.org_id={input.OrgId} AND w.store_id={input.StoreId} AND w.product_id={input.ProductId}
              AND w.quantity>=c.reserved_quantity AND w.quantity<=999999999.999
            """, ct);
        if (synced > 0) outbox.Enqueue(new StockAvailabilityChanged());
        audit.Record("accounting.stock_opened", "StockOpening", input.Id.ToString(), input);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(input.Id);
    }

    private static Task<List<StockImpact>> Impact(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<StockImpact>($"""
            WITH items AS (
                SELECT d.id,d.kind,d.status,d.native_org_id,d.native_store_id,d.details->'catalogFallback' AS fallback,
                    (v->'product'->>'id')::uuid AS product_id,
                    max(v->'product'->>'title') AS title,sum((v->>'quantity')::numeric) AS qty
                FROM accounting.documents d CROSS JOIN LATERAL jsonb_array_elements(d.details->'products') v
                WHERE d.id={id} AND d.native_partner_id IS NOT NULL
                GROUP BY d.id,(v->'product'->>'id')::uuid
            )
            SELECT i.product_id,i.title,
                coalesce(m.resulting_quantity-m.delta,
                    (i.fallback->>'before')::numeric,
                    CASE WHEN i.status='draft' AND o.id IS NOT NULL AND s_any.warehouse_store_id IS NULL AND coalesce(w.quantity,0)=0
                        THEN coalesce(s_any.quantity,0) ELSE coalesce(w.quantity,0) END) AS before,
                coalesce(m.delta,CASE WHEN i.kind IN ('in','customerReturn') THEN qty ELSE -qty END) AS change,
                coalesce(m.resulting_quantity,
                    (i.fallback->>'after')::numeric,
                    (CASE WHEN i.status='draft' AND o.id IS NOT NULL AND s_any.warehouse_store_id IS NULL AND coalesce(w.quantity,0)=0
                        THEN coalesce(s_any.quantity,0) ELSE coalesce(w.quantity,0) END)
                    + CASE WHEN i.kind IN ('in','customerReturn') THEN qty ELSE -qty END) AS after,
                CASE WHEN i.status='draft' THEN s_linked.reserved_quantity END AS reserved_quantity,
                coalesce(i.status='draft' AND w.product_id IS NULL AND NOT (o.id IS NOT NULL AND s_any.warehouse_store_id IS NULL),false) AS first_movement,
                coalesce(i.status='draft' AND s_any.warehouse_store_id IS NULL,false) AS unlinked_from_shop
            FROM items i
            LEFT JOIN accounting.warehouse_stock w ON w.org_id=i.native_org_id
                AND w.store_id=i.native_store_id AND w.product_id=i.product_id
            LEFT JOIN catalog.product_stock s_linked ON s_linked.product_id=i.product_id
                AND s_linked.warehouse_org_id=i.native_org_id AND s_linked.warehouse_store_id=i.native_store_id
            LEFT JOIN accounting.recommendation_offers o ON o.invoice_id=i.id AND o.product_id=i.product_id
            LEFT JOIN catalog.product_stock s_any ON s_any.product_id=i.product_id
            LEFT JOIN accounting.stock_movements m ON m.document_id=i.id
                AND m.store_id=i.native_store_id AND m.product_id=i.product_id AND NOT m.is_reversal
            ORDER BY i.product_id
            """).ToListAsync(ct);

    private static async Task<IResult> State(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, ct);
        var invoice = await db.Database.SqlQuery<NativeInvoice>($"""
            SELECT id,status,kind,day,total,org_id,store_id FROM accounting.invoice_operations WHERE id={id}
            """).SingleOrDefaultAsync(ct);
        if (invoice is null) return Results.NotFound();
        var store = await db.Database.SqlQuery<string>($"SELECT title AS \"Value\" FROM accounting.references WHERE id={invoice.StoreId}").SingleAsync(ct);
        var payments = await db.Database.SqlQuery<InvoicePayment>($"""
            SELECT id,day,amount,method,account_title,reference FROM accounting.invoice_payments
            WHERE document_id={id} ORDER BY day,created_at,id
            """).ToListAsync(ct);
        var paid = payments.Sum(p => p.Amount);
        var revision = await db.Database.SqlQuery<string>($"SELECT md5((details->'request')::text) AS \"Value\" FROM accounting.documents WHERE id={id}").SingleAsync(ct);
        static string Money(decimal value) => value.ToString("F2", CultureInfo.InvariantCulture);
        var offer = await RecommendationOfferWorkflow.ForInvoice(id, db, ct);
        return Results.Ok(new InvoiceState(invoice.Status, invoice.OrgId, invoice.StoreId, store, revision, Money(invoice.Total), Money(paid),
            invoice.Status == "posted" ? Money(invoice.Total - paid) : null, await Impact(id, db, ct),
            payments.Select(p => new RecordedPayment(p.Id, p.Day, Money(p.Amount), p.Method, p.AccountTitle, p.Reference)).ToList(),
            offer == null ? null : new InvoiceOfferReservation(offer.Quantity, offer.Unit)));
    }

    private static async Task<NativeInvoice?> Lock(Guid id, PoliValkoDbContext db, CancellationToken ct) =>
        (await db.Database.SqlQuery<NativeInvoice>($"""
            SELECT id,status,kind,day,total,native_org_id AS org_id,native_store_id AS store_id FROM accounting.documents
            WHERE id={id} AND source_account='polivalko-native' AND native_partner_id IS NOT NULL
              AND ((entity_type='invoice' AND kind IN ('in','out')) OR (entity_type='customerReturn' AND kind='customerReturn'))
            FOR UPDATE
            """).ToListAsync(ct)).SingleOrDefault();

    private static async Task<IResult> Post(Guid id, PostInvoice confirmation, HttpContext http, IStaffAccessResolver accessResolver,
        PoliValkoDbContext db, ICatalogReservations reservations, IOutbox outbox, IAuditLog audit, CancellationToken ct)
    {
        if (confirmation.LinkUnlinkedToShop)
        {
            var access = await accessResolver.GetStaffAccessAsync(http.User, http.Items, ct);
            if (access is null || !access.HasAny([PermissionKeys.CatalogImportRun])) return Results.Forbid();
        }
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var invoice = await Lock(id, db, ct);
        if (invoice is null) return Results.NotFound();
        var revision = await db.Database.SqlQuery<string>($"SELECT md5((details->'request')::text) AS \"Value\" FROM accounting.documents WHERE id={id}").SingleAsync(ct);
        if (confirmation.Revision != revision) return Conflict("Чернетку змінили. Перегляньте актуальні позиції перед проведенням.");
        if (invoice.Status == "posted") return Results.Ok(id);
        if (invoice.Status != "draft") return Conflict("Провести можна лише чернетку.");
        var lines = await Impact(id, db, ct);
        if (lines.Count == 0) return Conflict("Додайте товарні позиції.");
        var ids = lines.Select(l => l.ProductId).ToArray();
        var hasArchived = await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value" FROM catalog.products WHERE id=ANY({ids}) AND is_archived
            """).AnyAsync(ct);
        if (hasArchived) return Conflict("У документі є архівні товари. Відновіть їх із архіву або приберіть із чернетки.");
        var offer = await RecommendationOfferWorkflow.ForInvoice(id, db, ct);
        var unlinkedCatalogFallback = false;
        if (offer != null)
        {
            await reservations.LockAsync(ids, ct);
            var source = await RecommendationOfferWorkflow.StockSource(offer.ProductId, db, ct);
            if (source is { StoreId: null, OrganizationId: null })
            {
                var currentWh = await StockPosting.QuantitiesAsync(db, invoice.OrgId, invoice.StoreId, ids, ct);
                if (currentWh.GetValueOrDefault(offer.ProductId) == 0m)
                    unlinkedCatalogFallback = true;
            }
        }
        if (!unlinkedCatalogFallback)
        {
            var lockConflict = await StockPosting.LockAsync(db, reservations, invoice.OrgId, invoice.StoreId, ids, invoice.Day,
                "Дата накладної передує початковому залишку на цьому складі.", ct);
            if (lockConflict != null) return Conflict(lockConflict);
            lines = await Impact(id, db, ct);
            var shortage = lines.FirstOrDefault(l => l.After < 0);
            if (shortage != null) return Conflict($"Недостатньо товару «{shortage.Title}» на вибраному складі. Доступно {shortage.Before}.");
        }
        else
        {
            lines = await Impact(id, db, ct);
            var shortage = lines.FirstOrDefault(l => l.After < 0);
            if (shortage != null) return Conflict($"Недостатньо товару «{shortage.Title}» у каталозі. Доступно {shortage.Before}.");
        }
        if (offer != null)
        {
            if (offer.Status != "reserved" || invoice.Kind != "out" || lines.Count != 1 ||
                lines[0].ProductId != offer.ProductId || lines[0].Change != -offer.Quantity)
                return Conflict("Накладна не відповідає чинному резерву цієї пропозиції.");
            // Stock is locked. For a linked warehouse, the ledger below will synchronize the shop quantity.
            // An independent shop balance needs the same physical shipment deducted explicitly.
            var consumed = await db.Database.ExecuteSqlAsync($"""
                UPDATE catalog.product_stock s SET reserved_quantity=s.reserved_quantity-o.quantity,
                    quantity=CASE WHEN s.warehouse_store_id IS NULL THEN s.quantity-o.quantity ELSE s.quantity END,updated_at=now()
                FROM accounting.recommendation_offers o JOIN accounting.documents d ON d.id=o.invoice_id
                WHERE o.id={offer.Id} AND d.id={id} AND o.status='reserved' AND d.native_partner_id=o.partner_id
                    AND s.product_id=o.product_id AND s.reserved_quantity>=o.quantity AND s.quantity>=s.reserved_quantity
                    AND jsonb_array_length(d.details->'products')=1
                    AND (d.details->'products'->0->>'price')::numeric=o.price
                    AND ((s.warehouse_store_id IS NULL AND s.warehouse_org_id IS NULL)
                      OR (s.warehouse_org_id,s.warehouse_store_id)=(d.native_org_id,d.native_store_id))
                """, ct);
            if (consumed != 1) return Conflict("Перевірте клієнта, ціну, склад і залишок резерву за цією пропозицією.");
            await db.Database.ExecuteSqlAsync($"UPDATE accounting.recommendation_offers SET status='fulfilled',changed_at=now() WHERE id={offer.Id}", ct);
            audit.Record("recommendation.fulfilled", "RecommendationOffer", offer.Id.ToString(), new { invoiceId = id, offer.ProductId, offer.Quantity });
        }
        var synced = 0;
        var linkedToShop = 0;
        if (!unlinkedCatalogFallback)
        {
            var deltas = lines.Select(l => l.Change).ToArray();
            var (applied, appliedSynced) = await StockPosting.ApplyAsync(db, id, invoice.OrgId, invoice.StoreId, ids, deltas, ct);
            if (!applied) return Conflict(StockPosting.ShopConflict);
            synced = appliedSynced;
            if (confirmation.LinkUnlinkedToShop && invoice.Kind == "in")
            {
                linkedToShop = await StockPosting.LinkUnlinkedAsync(db, invoice.OrgId, invoice.StoreId, ids, ct);
                synced += linkedToShop;
            }
        }
        if (synced > 0 || offer != null) outbox.Enqueue(new StockAvailabilityChanged());
        if (unlinkedCatalogFallback)
        {
            await db.Database.ExecuteSqlAsync($"""
                UPDATE accounting.documents SET status='posted',
                    details=details||jsonb_build_object('catalogFallback',jsonb_build_object('before',{lines[0].Before},'after',{lines[0].After}))
                WHERE id={id}
                """, ct);
        }
        else
        {
            await db.Database.ExecuteSqlAsync($"UPDATE accounting.documents SET status='posted' WHERE id={id}", ct);
        }
        audit.Record("accounting.invoice_posted", "AccountingDocument", id.ToString(), new { invoice.Kind, invoice.Total, invoice.StoreId, unlinkedCatalogFallback, linkedToShop });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static async Task<IResult> Unpost(Guid id, PoliValkoDbContext db, ICatalogReservations reservations,
        IOutbox outbox, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var invoice = await Lock(id, db, ct);
        if (invoice is null) return Results.NotFound();
        if (invoice.Status == "cancelled")
        {
            var alreadyUnposted = await db.Database.SqlQuery<int>($"""
                SELECT 1 AS "Value" FROM accounting.documents WHERE id={id} AND coalesce((details->>'unposted')::boolean,false)
                """).AnyAsync(ct);
            return alreadyUnposted ? Results.Ok(id) : Conflict("Сторнувати можна лише проведений документ.");
        }
        if (invoice.Status != "posted") return Conflict("Сторнувати можна лише проведений документ.");
        var hasPayments = await db.Database.SqlQuery<int>($"""
            SELECT 1 AS "Value" FROM accounting.invoice_payments WHERE document_id={id}
            """).AnyAsync(ct);
        if (hasPayments) return Conflict("Спочатку видаліть оплати за цим документом.");
        var offer = await RecommendationOfferWorkflow.ForInvoice(id, db, ct);
        var movements = await StockPosting.PostedMovementsAsync(db, id, ct);
        var synced = 0;
        if (movements.Count > 0)
        {
            var stores = movements.Select(m => m.StoreId).Distinct().ToArray();
            var productIds = movements.Select(m => m.ProductId).Distinct().ToArray();
            var lockConflict = await StockPosting.LockStoresAsync(db, reservations, invoice.OrgId, stores, productIds, null, "", ct);
            if (lockConflict != null) return Conflict(lockConflict);
            var (conflict, reversedSynced) = await StockPosting.ReverseAsync(db, id, invoice.OrgId, movements, ct);
            if (conflict != null) return Conflict(conflict);
            synced = reversedSynced;
        }
        if (offer != null && offer.Status == "fulfilled")
        {
            if (movements.Count == 0) await reservations.LockAsync([offer.ProductId], ct);
            var restored = await db.Database.ExecuteSqlAsync($"""
                UPDATE catalog.product_stock SET quantity=quantity+{offer.Quantity},updated_at=now()
                WHERE product_id={offer.ProductId} AND warehouse_store_id IS NULL
                  AND quantity+{offer.Quantity}<=999999999.999
                """, ct);
            if (movements.Count == 0 && restored == 0)
                return Conflict("Товар уже прив’язано до складу після проведення цієї пропозиції. Відв’яжіть склад або відкоригуйте залишок вручну.");
            synced += restored;
            await db.Database.ExecuteSqlAsync($"UPDATE accounting.recommendation_offers SET status='released',changed_at=now() WHERE id={offer.Id}", ct);
        }
        await db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.documents SET status='cancelled',details=details||jsonb_build_object('unposted',true) WHERE id={id}
            """, ct);
        if (synced > 0 || offer != null) outbox.Enqueue(new StockAvailabilityChanged());
        audit.Record("accounting.invoice_unposted", "AccountingDocument", id.ToString(), new { invoice.Kind, invoice.Total, invoice.StoreId });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static Task<IResult> Pay(Guid id, InvoicePayment payment, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct) =>
        RecordPayment(id, false, payment, db, audit, ct);

    internal static Task<IResult> PayOpening(Guid id, InvoicePayment payment, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct) =>
        RecordPayment(id, true, payment, db, audit, ct);

    private static async Task<IResult> RecordPayment(Guid id, bool opening, InvoicePayment payment, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        if (payment.Id == Guid.Empty || payment.Amount <= 0 || decimal.Round(payment.Amount, 2) != payment.Amount ||
            payment.Method is not ("bank" or "cash") || string.IsNullOrWhiteSpace(payment.AccountTitle) ||
            payment.AccountTitle.Length > 150 || string.IsNullOrWhiteSpace(payment.Reference) || payment.Reference.Length > 150)
            return Results.BadRequest(new { title = "Вкажіть рахунок або касу, номер документа і суму в гривнях до копійки." });
        payment = payment with { AccountTitle = payment.AccountTitle.Trim(), Reference = payment.Reference.Trim() };
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        Guid? openingId = opening ? id : null, documentId = opening ? null : id;
        if (opening)
        {
            var days = await db.Database.SqlQuery<DateOnly>($"""
                SELECT day AS "Value" FROM accounting.partner_openings WHERE id={id} FOR UPDATE
                """).ToListAsync(ct);
            if (days.Count == 0) return Results.NotFound();
            if (payment.Day < days[0]) return Conflict("Дата оплати передує початковому боргу.");
        }
        else
        {
            var invoice = await Lock(id, db, ct);
            if (invoice is null) return Results.NotFound();
            if (invoice.Status != "posted" || payment.Day < invoice.Day) return Conflict("Оплата має стосуватися проведеної накладної та бути датована не раніше за неї.");
        }
        var existing = await db.Database.SqlQuery<InvoicePayment>($"""
            SELECT id,day,amount,method,account_title,reference FROM accounting.invoice_payments WHERE id={payment.Id}
                AND (document_id={documentId}::uuid OR opening_id={openingId}::uuid)
            """).SingleOrDefaultAsync(ct);
        if (existing != null) return payment == existing ? Results.Ok(payment.Id) : Conflict("Оплату з цим кодом уже зареєстровано з іншими реквізитами.");
        var due = await db.Database.SqlQuery<decimal>($"""
            SELECT due AS "Value" FROM accounting.invoice_operations WHERE id={documentId}::uuid
            UNION ALL SELECT due FROM accounting.partner_opening_balances WHERE id={openingId}::uuid
            """).SingleAsync(ct);
        if (payment.Amount > due) return Conflict($"Сума перевищує залишок боргу ({due} грн).");
        var inserted = await db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.invoice_payments(id,document_id,opening_id,day,amount,method,account_title,reference)
            VALUES({payment.Id},{documentId},{openingId},{payment.Day},{payment.Amount},{payment.Method},{payment.AccountTitle},{payment.Reference})
            ON CONFLICT(id) DO NOTHING
            """, ct);
        if (inserted == 0) return Conflict("Ідентифікатор оплати вже використано.");
        audit.Record("accounting.payment_recorded", opening ? "PartnerOpening" : "AccountingDocument", id.ToString(), payment);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(payment.Id);
    }

    private static async Task<IResult> DeletePayment(Guid id, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var target = await db.Database.SqlQuery<PaymentTarget>($"""
            SELECT id,document_id,opening_id,day,amount,method,account_title,reference
            FROM accounting.invoice_payments WHERE id={id}
            """).SingleOrDefaultAsync(ct);
        if (target is null) return Results.NotFound();
        if (target.DocumentId is Guid docId)
            await db.Database.ExecuteSqlAsync($"SELECT 1 FROM accounting.documents WHERE id={docId} FOR UPDATE", ct);
        else if (target.OpeningId is Guid openId)
            await db.Database.ExecuteSqlAsync($"SELECT 1 FROM accounting.partner_openings WHERE id={openId} FOR UPDATE", ct);
        var deleted = await db.Database.ExecuteSqlAsync($"DELETE FROM accounting.invoice_payments WHERE id={id}", ct);
        if (deleted == 0) return Results.NotFound();
        audit.Record("accounting.payment_deleted",
            target.OpeningId.HasValue ? "PartnerOpening" : "AccountingDocument",
            (target.OpeningId ?? target.DocumentId)?.ToString() ?? id.ToString(),
            target);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static IResult Conflict(string detail) => Results.Problem(detail: detail, statusCode: StatusCodes.Status409Conflict);
}
