using System.Globalization;
using System.Text.Json;
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

// Quantity is the received, written-off, or transferred amount, or the counted amount for a recount.
public sealed record StockOperationLine(Guid ProductId, decimal Quantity, decimal? Price);
public sealed record StockOperationDraft(Guid Id, string Kind, DateOnly Day, Guid OrgId, Guid StoreId,
    string? Reason, string? Comment, List<StockOperationLine>? Lines, Guid? TargetStoreId = null);
public sealed record StockOperationChange(string Revision, StockOperationDraft Draft);
public sealed record PostStockOperation(string Revision);
// Book is the recorded quantity a recount was compared with; Before/Change/After are the warehouse movement,
// expected for a draft and recorded once the operation is posted. FirstMovement marks a draft line whose product has
// never moved on this warehouse: posting it closes the way to an opening balance for that product there.
public sealed record StockOperationLineState(Guid ProductId, string Title, string Sku, decimal Quantity, decimal? Price,
    decimal? Book, decimal Before, decimal Change, decimal After, bool FirstMovement, decimal? ReservedQuantity = null);
public sealed record StockOperationState(Guid Id, string Kind, string Status, string Number, DateOnly Day,
    Guid OrgId, Guid StoreId, string Store, string? Reason, string? Comment, string Revision, string? Total,
    List<StockOperationLineState> Lines, Guid? TargetStoreId = null, string? TargetStore = null);
internal sealed record StockOperationRow(Guid Id, string Kind, string Status, string Number, DateOnly Day,
    Guid OrgId, Guid StoreId, string Store, Guid? TargetStoreId, string? TargetStore, string Details, string Revision, decimal? Total);
internal sealed record StoredLine(StoredProduct Product, decimal Quantity, decimal? Price, decimal? Book);
internal sealed record StoredProduct(Guid Id, string Title, string Sku);
internal sealed record PostedLine(Guid ProductId, decimal Before, decimal Change, decimal After);
internal sealed record StoredOperation(string? Reason, string? Comment, List<StoredLine> Products, List<PostedLine>? Posted, bool? Unposted = null);

internal static class StockOperations
{
    internal static readonly string[] Kinds = ["income", "writeOff", "recount", "transfer"];
    private static readonly string[] Reasons = ["defect", "loss", "regrade", "own", "other"];
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/stock-operations", Create).WithName("ConsoleCreateStockOperation")
            .RequirePermission(PermissionKeys.AccountingEdit).Produces<Guid>();
        group.MapPut("/stock-operations/{id:guid}", Update).WithName("ConsoleUpdateStockOperation")
            .RequirePermission(PermissionKeys.AccountingEdit).Produces<Guid>();
        group.MapDelete("/stock-operations/{id:guid}", Delete).WithName("ConsoleDeleteStockOperation")
            .RequirePermission(PermissionKeys.AccountingEdit).Produces<Guid>();
        group.MapGet("/stock-operations/{id:guid}", State).WithName("ConsoleStockOperation").Produces<StockOperationState>();
        group.MapPost("/stock-operations/{id:guid}/post", Post).WithName("ConsolePostStockOperation")
            .RequirePermission(PermissionKeys.AccountingPost).Produces<Guid>();
        group.MapPost("/stock-operations/{id:guid}/unpost", Unpost).WithName("ConsoleUnpostStockOperation")
            .RequirePermission(PermissionKeys.AccountingPost).Produces<Guid>();
    }

    private static string? Check(StockOperationDraft input)
    {
        if (input.Id == Guid.Empty || !Kinds.Contains(input.Kind) || input.Day == default || input.OrgId == Guid.Empty || input.StoreId == Guid.Empty)
            return "Вкажіть вид операції, дату, організацію та склад.";
        if (input.Kind == "transfer")
        {
            if (input.TargetStoreId is not { } target || target == Guid.Empty)
                return "Виберіть склад-отримувач.";
            if (target == input.StoreId)
                return "Склад-отримувач має відрізнятися від складу-відправника.";
        }
        else if (input.TargetStoreId != null)
        {
            return "Склад-отримувач вказують лише для переміщення.";
        }
        if (input.Lines is not { Count: > 0 and <= 250 } lines || lines.Any(l => l == null))
            return "Додайте від 1 до 250 товарів.";
        if (lines.Select(l => l.ProductId).Distinct().Count() != lines.Count) return "Кожен товар має бути в операції один раз.";
        if (lines.Any(l => decimal.Round(l.Quantity, 3) != l.Quantity || l.Quantity > 1000000 ||
                (input.Kind == "recount" ? l.Quantity < 0 : l.Quantity <= 0)))
            return input.Kind == "recount" ? "Фактична кількість — від 0 до тисячних." : "Кількість має бути більшою за 0, до тисячних.";
        if (input.Kind == "income" ? lines.Any(l => l.Price is not { } p || p <= 0 || p > 100000000 || decimal.Round(p, 2) != p)
                                   : lines.Any(l => l.Price != null))
            return input.Kind == "income" ? "Вкажіть ціну за одиницю більшу за 0, до копійки." : "Ціну вказують лише в оприбуткуванні.";
        if (input.Comment is { Length: > 500 }) return "Коментар — до 500 символів.";
        if (input.Kind == "writeOff" && !Reasons.Contains(input.Reason ?? "")) return "Виберіть причину списання.";
        if (input.Kind != "writeOff" && input.Reason != null) return "Причину вказують лише для списання.";
        if (input.Reason == "other" && string.IsNullOrWhiteSpace(input.Comment)) return "Опишіть причину списання в коментарі.";
        return null;
    }

    private static Task<IResult> Create(StockOperationDraft input, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct) =>
        Save(input, null, db, audit, ct);

    private static Task<IResult> Update(Guid id, StockOperationChange change, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct) =>
        change.Draft == null || change.Draft.Id != id || string.IsNullOrWhiteSpace(change.Revision)
            ? Task.FromResult(Invalid("Невідома версія чернетки."))
            : Save(change.Draft, change.Revision, db, audit, ct);

    private static async Task<IResult> Save(StockOperationDraft input, string? revision, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        if (Check(input) is { } problem) return Invalid(problem);
        var lines = input.Lines!;
        input = input with { Comment = string.IsNullOrWhiteSpace(input.Comment) ? null : input.Comment.Trim() };
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var org = await AccountingEntry.Organizations(db).SingleOrDefaultAsync(x => x.Id == input.OrgId.ToString(), ct);
        var store = await AccountingEntry.Stores(db).SingleOrDefaultAsync(x => x.Id == input.StoreId.ToString(), ct);
        if (org == null || store == null) return Invalid("Організацію або склад не знайдено.");
        RegisterReference? targetStore = null;
        if (input.Kind == "transfer")
        {
            targetStore = await AccountingEntry.Stores(db).SingleOrDefaultAsync(x => x.Id == input.TargetStoreId!.Value.ToString(), ct);
            if (targetStore == null) return Invalid("Склад-отримувач не знайдено.");
        }
        var ids = lines.Select(l => l.ProductId).ToArray();
        var products = await db.Database.SqlQuery<ProductReference>($"""
            SELECT id,coalesce(nullif(display_name,''),name) AS name,sku FROM catalog.products WHERE id=ANY({ids})
            """).ToDictionaryAsync(p => p.Id, ct);
        if (products.Count != ids.Length) return Invalid("Один із товарів відсутній у каталозі.");
        // A recount remembers the recorded quantity it was compared with, so later sales do not change its difference.
        // Editing the draft keeps that quantity for lines already counted on the same warehouse; only new lines take today's.
        Dictionary<Guid, decimal> book = [];
        if (input.Kind == "recount")
        {
            if (revision != null && await Find(input.Id, false, db, ct) is { } saved && saved.OrgId == input.OrgId && saved.StoreId == input.StoreId)
                foreach (var line in JsonSerializer.Deserialize<StoredOperation>(saved.Details, Json)!.Products)
                    if (line.Book is { } counted && ids.Contains(line.Product.Id)) book[line.Product.Id] = counted;
            var fresh = ids.Where(id => !book.ContainsKey(id)).ToArray();
            foreach (var (id, quantity) in await StockPosting.QuantitiesAsync(db, input.OrgId, input.StoreId, fresh, ct)) book[id] = quantity;
        }
        var positions = lines.Select(l => new
        {
            product = new { id = l.ProductId, title = products[l.ProductId].Name, sku = products[l.ProductId].Sku },
            store = new { external_id = store.Id, title = store.Title },
            targetStore = targetStore == null ? null : new { external_id = targetStore.Id, title = targetStore.Title },
            quantity = l.Quantity,
            price = l.Price,
            total = l.Price is { } p ? decimal.Round(l.Quantity * p, 2, MidpointRounding.AwayFromZero) : (decimal?)null,
            book = input.Kind == "recount" ? book.GetValueOrDefault(l.ProductId) : (decimal?)null,
        }).ToList();
        decimal? total = input.Kind == "income" ? positions.Sum(p => p.total!.Value) : null;
        string[] storeIds = targetStore != null ? [store.Id, targetStore.Id] : [store.Id];
        Guid? targetStoreId = input.Kind == "transfer" ? input.TargetStoreId : null;
        var request = JsonSerializer.Serialize(input);
        var details = JsonSerializer.Serialize(new
        {
            origin = "console",
            request = input,
            reason = input.Reason,
            comment = input.Comment,
            targetStore = targetStore == null ? null : new { id = targetStore.Id, title = targetStore.Title },
            products = positions
        });
        if (revision != null)
        {
            var updated = await db.Database.ExecuteSqlAsync($"""
                UPDATE accounting.documents SET day={input.Day},organization_id={org.Id},organization={org.Title},
                    store_ids={storeIds},total={total}::numeric,details={details}::jsonb,
                    native_org_id={input.OrgId},native_store_id={input.StoreId},native_target_store_id={targetStoreId}
                WHERE id={input.Id} AND entity_type='stockOperation' AND source_account='polivalko-native' AND status='draft'
                    AND kind={input.Kind} AND md5(details::text)={revision}
                """, ct);
            if (updated == 0) return Results.Problem(detail: "Чернетку вже змінили або провели. Оновіть картку.", statusCode: 409);
            await db.Database.ExecuteSqlAsync($"DELETE FROM accounting.product_document_lines WHERE document_id={input.Id}", ct);
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.product_document_lines(document_id,position,source_account,product_ref)
                SELECT {input.Id},n::int,'polivalko-native',lower(p->'product'->>'id')
                FROM jsonb_array_elements({details}::jsonb->'products') WITH ORDINALITY AS t(p,n)
                """, ct);
            audit.Record("accounting.stock_operation_updated", "AccountingDocument", input.Id.ToString(), new { input.Kind, total });
        }
        else
        {
            var (prefix, sequence) = input.Kind switch
            {
                "income" => ("ОП-", "accounting.stock_income_numbers"),
                "writeOff" => ("СП-", "accounting.stock_write_off_numbers"),
                "transfer" => ("ПМ-", "accounting.stock_transfer_numbers"),
                _ => ("ПР-", "accounting.stock_recount_numbers"),
            };
            var inserted = await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.documents(id,source_account,source_id,entity_type,kind,number,day,status,organization_id,
                    organization,store_ids,currency,total,details,native_org_id,native_store_id,native_target_store_id)
                SELECT {input.Id},'polivalko-native',{input.Id.ToString()},'stockOperation',{input.Kind},
                    {prefix} || nextval({sequence}::regclass),{input.Day},'draft',{org.Id},{org.Title},{storeIds},
                    'UAH',{total}::numeric,{details}::jsonb,{input.OrgId},{input.StoreId},{targetStoreId}
                WHERE NOT EXISTS (SELECT 1 FROM accounting.documents WHERE id={input.Id})
                ON CONFLICT (id) DO NOTHING
                """, ct);
            if (inserted == 0)
            {
                var same = await db.Database.SqlQuery<int>($"""
                    SELECT 1 AS "Value" FROM accounting.documents WHERE id={input.Id} AND details->'request'={request}::jsonb
                    """).AnyAsync(ct);
                return same ? Results.Ok(input.Id) : Results.Conflict();
            }
            audit.Record("accounting.stock_operation_created", "AccountingDocument", input.Id.ToString(), new { input.Kind, total });
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(input.Id);
    }

    private static async Task<IResult> Delete(Guid id, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var row = await Find(id, true, db, ct);
        if (row == null) return Results.NotFound();
        if (row.Status != "draft") return Conflict("Видалити можна лише чернетку.");
        await db.Database.ExecuteSqlAsync($"DELETE FROM accounting.product_document_lines WHERE document_id={id}", ct);
        await db.Database.ExecuteSqlAsync($"DELETE FROM accounting.documents WHERE id={id}", ct);
        audit.Record("accounting.stock_operation_deleted", "AccountingDocument", id.ToString(), new { row.Kind, row.Number });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static async Task<StockOperationRow?> Find(Guid id, bool forUpdate, PoliValkoDbContext db, CancellationToken ct)
    {
        var rows = forUpdate
            ? db.Database.SqlQuery<StockOperationRow>($"""
                SELECT d.id,d.kind,d.status,d.number,d.day,d.native_org_id AS org_id,d.native_store_id AS store_id,s.title AS store,
                    d.native_target_store_id AS target_store_id,ts.title AS target_store,
                    d.details::text AS details,md5(d.details::text) AS revision,d.total
                FROM accounting.documents d
                JOIN accounting.references s ON s.id=d.native_store_id
                LEFT JOIN accounting.references ts ON ts.id=d.native_target_store_id
                WHERE d.id={id} AND d.entity_type='stockOperation' AND d.source_account='polivalko-native' FOR UPDATE OF d
                """)
            : db.Database.SqlQuery<StockOperationRow>($"""
                SELECT d.id,d.kind,d.status,d.number,d.day,d.native_org_id AS org_id,d.native_store_id AS store_id,s.title AS store,
                    d.native_target_store_id AS target_store_id,ts.title AS target_store,
                    d.details::text AS details,md5(d.details::text) AS revision,d.total
                FROM accounting.documents d
                JOIN accounting.references s ON s.id=d.native_store_id
                LEFT JOIN accounting.references ts ON ts.id=d.native_target_store_id
                WHERE d.id={id} AND d.entity_type='stockOperation' AND d.source_account='polivalko-native'
                """);
        return (await rows.ToListAsync(ct)).SingleOrDefault();
    }

    private static decimal Delta(string kind, StoredLine line) => kind switch
    {
        "income" => line.Quantity,
        "writeOff" or "transfer" => -line.Quantity,
        _ => line.Quantity - (line.Book ?? 0),
    };

    private static async Task<IResult> State(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var row = await Find(id, false, db, ct);
        if (row == null) return Results.NotFound();
        var stored = JsonSerializer.Deserialize<StoredOperation>(row.Details, Json)!;
        var ids = stored.Products.Select(p => p.Product.Id).ToArray();
        var current = row.Status == "draft" ? await StockPosting.QuantitiesAsync(db, row.OrgId, row.StoreId, ids, ct) : [];
        var targetCurrent = row.Status == "draft" && row.TargetStoreId is Guid targetId
            ? await StockPosting.QuantitiesAsync(db, row.OrgId, targetId, ids, ct)
            : null;
        var reserved = row.Status == "draft" ? await StockPosting.ReservedAsync(db, row.OrgId, row.StoreId, ids, ct) : [];
        var posted = stored.Posted?.ToDictionary(p => p.ProductId) ?? [];
        var lines = stored.Products.Select(p =>
        {
            var change = Delta(row.Kind, p);
            var before = posted.TryGetValue(p.Product.Id, out var done) ? done.Before : current.GetValueOrDefault(p.Product.Id);
            var firstMovement = row.Status == "draft"
                && (!current.ContainsKey(p.Product.Id) || (targetCurrent != null && !targetCurrent.ContainsKey(p.Product.Id)));
            decimal? reservedQty = row.Status == "draft" && reserved.TryGetValue(p.Product.Id, out var r) ? r : null;
            return new StockOperationLineState(p.Product.Id, p.Product.Title, p.Product.Sku, p.Quantity, p.Price, p.Book,
                before, done?.Change ?? change, done?.After ?? before + change, firstMovement, reservedQty);
        }).ToList();
        return Results.Ok(new StockOperationState(row.Id, row.Kind, row.Status, row.Number, row.Day, row.OrgId, row.StoreId, row.Store,
            stored.Reason, stored.Comment, row.Revision, row.Total?.ToString("F2", CultureInfo.InvariantCulture), lines,
            row.TargetStoreId, row.TargetStore));
    }

    private static async Task<IResult> Post(Guid id, PostStockOperation confirmation, PoliValkoDbContext db, ICatalogReservations reservations,
        IOutbox outbox, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var row = await Find(id, true, db, ct);
        if (row == null) return Results.NotFound();
        if (row.Status == "posted") return Results.Ok(id);
        if (row.Status != "draft") return Conflict("Провести можна лише чернетку.");
        if (confirmation.Revision != row.Revision) return Conflict("Чернетку змінили. Перегляньте актуальні позиції перед проведенням.");
        var stored = JsonSerializer.Deserialize<StoredOperation>(row.Details, Json)!;
        var ids = stored.Products.Select(p => p.Product.Id).ToArray();
        var isTransfer = row.Kind == "transfer";
        if (isTransfer && (row.TargetStoreId is not { } targetStore || targetStore == row.StoreId))
            return Conflict("Вкажіть коректний склад-отримувач для переміщення.");
        var lockConflict = isTransfer
            ? await StockPosting.LockStoresAsync(db, reservations, row.OrgId, [row.StoreId, row.TargetStoreId!.Value], ids, row.Day,
                "Дата операції передує початковому залишку на вибраному складі.", ct)
            : await StockPosting.LockAsync(db, reservations, row.OrgId, row.StoreId, ids, row.Day,
                "Дата операції передує початковому залишку на цьому складі.", ct);
        if (lockConflict != null) return Conflict(lockConflict);
        var current = await StockPosting.QuantitiesAsync(db, row.OrgId, row.StoreId, ids, ct);
        var moves = stored.Products.Select(p =>
        {
            var before = current.GetValueOrDefault(p.Product.Id);
            var change = Delta(row.Kind, p);
            return (p.Product, Line: new PostedLine(p.Product.Id, before, change, before + change));
        }).ToList();
        var shortage = moves.FirstOrDefault(m => m.Line.After < 0);
        if (shortage.Line != null)
            return Conflict($"Недостатньо товару «{shortage.Product.Title}» на вибраному складі. Доступно {shortage.Line.Before}.");
        var changed = moves.Where(m => m.Line.Change != 0).ToList();
        var changedIds = changed.Select(m => m.Line.ProductId).ToArray();
        var changedDeltas = changed.Select(m => m.Line.Change).ToArray();
        var (applied, synced) = await StockPosting.ApplyAsync(db, id, row.OrgId, row.StoreId, changedIds, changedDeltas, ct);
        if (!applied) return Conflict(StockPosting.ShopConflict);
        if (isTransfer && changedIds.Length > 0)
        {
            var targetDeltas = changed.Select(m => -m.Line.Change).ToArray();
            var (targetApplied, targetSynced) = await StockPosting.ApplyAsync(db, id, row.OrgId, row.TargetStoreId!.Value,
                changedIds, targetDeltas, ct);
            if (!targetApplied) return Conflict(StockPosting.ShopConflict);
            synced += targetSynced;
        }
        if (synced > 0) outbox.Enqueue(new StockAvailabilityChanged());
        var posted = JsonSerializer.Serialize(moves.Select(m => m.Line), Json);
        await db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.documents SET status='posted',details=details||jsonb_build_object('posted',{posted}::jsonb) WHERE id={id}
            """, ct);
        audit.Record("accounting.stock_operation_posted", "AccountingDocument", id.ToString(),
            new { row.Kind, row.StoreId, row.TargetStoreId, Lines = changed.Count });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static async Task<IResult> Unpost(Guid id, PoliValkoDbContext db, ICatalogReservations reservations,
        IOutbox outbox, IAuditLog audit, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var row = await Find(id, true, db, ct);
        if (row == null) return Results.NotFound();
        var stored = JsonSerializer.Deserialize<StoredOperation>(row.Details, Json)!;
        if (row.Status == "cancelled")
            return stored.Unposted == true ? Results.Ok(id) : Conflict("Сторнувати можна лише проведену операцію.");
        if (row.Status != "posted") return Conflict("Сторнувати можна лише проведену операцію.");
        var movements = await StockPosting.PostedMovementsAsync(db, id, ct);
        var synced = 0;
        if (movements.Count > 0)
        {
            var stores = movements.Select(m => m.StoreId).Distinct().ToArray();
            var productIds = movements.Select(m => m.ProductId).Distinct().ToArray();
            var lockConflict = await StockPosting.LockStoresAsync(db, reservations, row.OrgId, stores, productIds, null, "", ct);
            if (lockConflict != null) return Conflict(lockConflict);
            var (conflict, reversedSynced) = await StockPosting.ReverseAsync(db, id, row.OrgId, movements, ct);
            if (conflict != null) return Conflict(conflict);
            synced = reversedSynced;
        }
        if (synced > 0) outbox.Enqueue(new StockAvailabilityChanged());
        await db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.documents SET status='cancelled',details=details||jsonb_build_object('unposted',true) WHERE id={id}
            """, ct);
        audit.Record("accounting.stock_operation_unposted", "AccountingDocument", id.ToString(),
            new { row.Kind, row.StoreId, row.TargetStoreId, Movements = movements.Count });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(id);
    }

    private static IResult Invalid(string message) => Results.ValidationProblem(new Dictionary<string, string[]> { ["stockOperation"] = [message] });
    private static IResult Conflict(string detail) => Results.Problem(detail: detail, statusCode: StatusCodes.Status409Conflict);
}
