using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Navkolo.Features.SalesArchive;
using PoliValko.Navkolo.Features.WorkForms;

namespace PoliValko.IntegrationTests;

public sealed class DnTradeWorkFormsApiTests(ApiFactory api)
{
    private const string Forms = "/api/v1/console/dntrade-work-forms";
    private const string Archive = "/api/v1/console/dntrade-archive";
    private static readonly string[] Permissions = [PermissionKeys.DnTradeArchiveView, PermissionKeys.DnTradeArchiveImport, PermissionKeys.DnTradeArchiveOriginal];
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Forms_keep_unknown_and_zero_values_and_apply_exact_versions_without_side_effects()
    {
        using var admin = await Staff.AdminAsync(api);
        var id = Guid.NewGuid();
        var url = $"{Forms}/{id}";
        var title = $"Залишок 10% {id:N}";
        const string note = "private-work-form-note: Робоче уточнення";
        var draft = new SaveDnTradeWorkFormRequest(null, "finance", "opening-balance", "draft", title, null, null, new(Note: note));
        var outboxBefore = await api.WithDbAsync(db => db.OutboxMessages.CountAsync(Ct));

        (await admin.GetAsync(url, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await admin.PutAsJsonAsync(url, draft with { Status = "archived" }, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PutAsJsonAsync(url, new { draft.Section, draft.Type, draft.Status, draft.Title, draft.Data }, TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var created = await (await admin.PutAsJsonAsync(url, draft, TestJson.Options, Ct)).ReadAsync<DnTradeWorkFormDto>();
        created.Id.ShouldBe(id);
        created.Version.ShouldBe(1);
        created.CreatedAt.ShouldBe(created.UpdatedAt);
        created.DocumentDate.ShouldBeNull();
        created.Data.Amount.ShouldBeNull();
        created.Data.Lines.ShouldBeNull();
        created.Data.Note.ShouldBe(note);
        (await admin.PutAsJsonAsync(url, draft, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var ready = draft with { ExpectedVersion = 1, Status = "ready" };
        var invalid = await (await admin.PutAsJsonAsync(url, ready, TestJson.Options, Ct)).ReadAsync<ProblemBody>(HttpStatusCode.BadRequest);
        invalid.Errors!.Keys.ShouldContain("data.amount");
        invalid.Errors!.Keys.ShouldContain("documentDate");
        ready = ready with
        {
            DocumentDate = new DateOnly(2026, 11, 20),
            Data = new(Organization: "Буча", Account: "Каса", Currency: "UAH", Amount: "0.00", Note: note),
        };
        var competing = await Task.WhenAll(admin.PutAsJsonAsync(url, ready, TestJson.Options, Ct), admin.PutAsJsonAsync(url, ready, TestJson.Options, Ct));
        var updated = await competing.Single(x => x.StatusCode == HttpStatusCode.OK).ReadAsync<DnTradeWorkFormDto>();
        competing.Single(x => x.StatusCode == HttpStatusCode.Conflict).IsSuccessStatusCode.ShouldBeFalse();
        updated.Version.ShouldBe(2);
        updated.Data.Amount.ShouldBe("0.00");
        updated.Data.Counterparty.ShouldBeNull();

        var archived = await (await admin.PutAsJsonAsync(url, ready with { Status = "archived", ExpectedVersion = 2 }, TestJson.Options, Ct))
            .ReadAsync<DnTradeWorkFormDto>();
        archived.Version.ShouldBe(3);
        (await admin.PutAsJsonAsync(url, ready with { ExpectedVersion = 3 }, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var list = await admin.ReadAsync<DnTradeWorkFormPageDto>($"{Forms}?q={Uri.EscapeDataString(title)}&section=finance&status=archived&page=1&pageSize=1");
        (list.Page, list.PageSize, list.TotalItems).ShouldBe((1, 1, 1));
        var summary = list.Items.ShouldHaveSingleItem();
        (summary.Id, summary.Version, summary.Status).ShouldBe((id, 3, "archived"));
        var detail = await admin.ReadAsync<DnTradeWorkFormDto>(url);
        (detail.SourceRecordId, detail.Data.Amount).ShouldBe((null, "0.00"));
        (await api.WithDbAsync(db => db.OutboxMessages.CountAsync(Ct))).ShouldBe(outboxBefore);
        var audit = await api.WithDbAsync(db => db.Set<AuditEntry>().Where(row => row.EntityId == id.ToString() && row.EntityType == "DnTradeWorkForm")
            .Select(row => row.Details).ToListAsync(Ct));
        audit.Count.ShouldBe(3);
        audit.ShouldAllBe(details => details != null && !details.Contains("private-work-form-note", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Multiple_same_type_forms_can_link_to_one_archive_record_without_changing_its_contents()
    {
        using var admin = await Staff.AdminAsync(api);
        var account = "forms-" + Guid.NewGuid().ToString("N");
        const string original = """
            {"schemaVersion":1,"source":"dntrade","entityType":"financialReport","sourceId":"balance","sourceDate":"2026-11-20","raw":{"balances":["0.00","12.30"]}}
            """;
        using var payload = new MemoryStream(Encoding.UTF8.GetBytes(original));
        var record = (await DnTradeArchiveInput.ReadAsync(payload, account, DateTimeOffset.UtcNow, Ct)).ShouldHaveSingleItem();
        await api.WithDbAsync(db =>
        {
            db.Add(record);
            return db.SaveChangesAsync(Ct);
        });
        var draft = new SaveDnTradeWorkFormRequest(null, "finance", "opening-balance", "draft", "Перша каса", null, record.Id, new(Account: "Перша каса"));

        var invalid = await (await admin.PutAsJsonAsync($"{Forms}/{Guid.NewGuid()}", draft with { SourceRecordId = Guid.NewGuid() }, TestJson.Options, Ct))
            .ReadAsync<ProblemBody>(HttpStatusCode.BadRequest);
        invalid.Errors!.Keys.ShouldContain("sourceRecordId");
        var first = await (await admin.PutAsJsonAsync($"{Forms}/{Guid.NewGuid()}", draft, TestJson.Options, Ct)).ReadAsync<DnTradeWorkFormDto>();
        var second = await (await admin.PutAsJsonAsync($"{Forms}/{Guid.NewGuid()}", draft with { Title = "Друга каса", Data = new(Account: "Друга каса") }, TestJson.Options, Ct))
            .ReadAsync<DnTradeWorkFormDto>();
        var list = await admin.ReadAsync<DnTradeWorkFormPageDto>($"{Forms}?sourceRecordId={record.Id}");
        list.TotalItems.ShouldBe(2);
        list.Items.Select(item => item.Id).Order().ShouldBe(new[] { first.Id, second.Id }.Order());
        (await admin.GetStringAsync($"{Archive}/{record.Id}/original", Ct)).ShouldBe(original);
    }

    [Theory]
    [InlineData(PermissionKeys.DnTradeArchiveView)]
    [InlineData(PermissionKeys.DnTradeArchiveImport)]
    [InlineData(PermissionKeys.DnTradeArchiveOriginal)]
    public async Task Every_permission_is_required_for_list_read_and_save(string missing)
    {
        using var admin = await Staff.AdminAsync(api);
        using var limited = await TestRoles.LoginWithPermissionsAsync(api, admin, Permissions.Where(permission => permission != missing).ToArray());
        using var guest = api.CreateClient();
        using var noCsrf = await Staff.SignInAsync(api, ApiFactory.AdminEmail);
        var id = Guid.NewGuid();
        var url = $"{Forms}/{id}";
        var draft = new SaveDnTradeWorkFormRequest(null, "directory", "counterparty", "draft", "Контрагент", null, null, new());

        (await guest.GetAsync(Forms, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await limited.GetAsync(Forms, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await limited.GetAsync(url, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await limited.PutAsJsonAsync(url, draft, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await noCsrf.PutAsJsonAsync(url, draft, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Rejects_invalid_decimal_fields_and_same_warehouse_movement_but_keeps_zero_inventory_count()
    {
        using var admin = await Staff.AdminAsync(api);
        var id = Guid.NewGuid();
        var url = $"{Forms}/{id}";
        var input = new SaveDnTradeWorkFormRequest(null, "warehouse", "movement", "ready", "Рух", new DateOnly(2026, 11, 20), null,
            new(Warehouse: "Буча", DestinationWarehouse: " Буча ", Lines: [new(Sku: "123", Quantity: "2.0000")]));
        var invalid = await (await admin.PutAsJsonAsync(url, input, TestJson.Options, Ct)).ReadAsync<ProblemBody>(HttpStatusCode.BadRequest);
        invalid.Errors!.Keys.ShouldContain("data.lines[0].quantity");
        invalid = await (await admin.PutAsJsonAsync(url, input with { Data = input.Data with { Lines = [new(Sku: "123", Quantity: "2.000")] } }, TestJson.Options, Ct))
            .ReadAsync<ProblemBody>(HttpStatusCode.BadRequest);
        invalid.Errors!.Keys.ShouldContain("data.destinationWarehouse");

        var inventory = input with { Type = "inventory", Data = new(Warehouse: "Буча", Lines: [new(Sku: "123", Quantity: "0.000")]) };
        var created = await (await admin.PutAsJsonAsync(url, inventory, TestJson.Options, Ct)).ReadAsync<DnTradeWorkFormDto>();
        created.Data.Lines!.ShouldHaveSingleItem().Quantity.ShouldBe("0.000");
        created.Data.Lines!.ShouldHaveSingleItem().ExpectedQuantity.ShouldBeNull();
    }

    [Fact]
    public async Task Sales_ready_requires_currency_and_a_price_for_each_line_and_accepts_an_explicit_zero_price()
    {
        using var admin = await Staff.AdminAsync(api);
        var url = $"{Forms}/{Guid.NewGuid()}";
        var line = new DnTradeWorkFormLine(Sku: "125", Quantity: "1");
        var request = new SaveDnTradeWorkFormRequest(null, "sales", "sale", "ready", "Продаж", new DateOnly(2026, 11, 20), null, new(Lines: [line]));
        var invalid = await (await admin.PutAsJsonAsync(url, request, TestJson.Options, Ct)).ReadAsync<ProblemBody>(HttpStatusCode.BadRequest);
        invalid.Errors!.Keys.ShouldContain("data.lines[0].unitPrice");
        invalid.Errors!.Keys.ShouldContain("data.currency");

        var ready = request with { Data = new(Currency: "UAH", Lines: [line with { UnitPrice = "0.00" }]) };
        var saved = await (await admin.PutAsJsonAsync(url, ready, TestJson.Options, Ct)).ReadAsync<DnTradeWorkFormDto>();
        saved.Data.Lines!.ShouldHaveSingleItem().UnitPrice.ShouldBe("0.00");
        saved.Data.Counterparty.ShouldBeNull();
    }
}
