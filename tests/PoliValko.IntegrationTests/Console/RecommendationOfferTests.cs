using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Console.Features.Accounting;
using PoliValko.Console.Features.Analytics;
using PoliValko.Identity.Features.Auth;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.IntegrationTests;

public sealed class RecommendationOfferTests(ApiFactory api)
{
    private const string Route = "/api/v1/console/accounting/recommendation-offers/";
    private const string Accounting = "/api/v1/console/accounting/";
    private sealed class Report(object payload) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(payload) });
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Invoice_consumes_only_its_agreed_reservation_once(bool linkedWarehouse)
    {
        var ct = TestContext.Current.CancellationToken;
        using var staff = await Staff.AdminAsync(api);
        var product = await api.AddProductAsync("ruchnyi-instrument", "Товар двох клієнтів", 99m, 5m);
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var org = Guid.NewGuid();
        var store = Guid.NewGuid();
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var last = new DateOnly(2026, 1, 12);
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.references(id,source_account,kind,source_id,title) VALUES
              ({org},'test','organization',{org.ToString()},'ФОП'),({store},'test','store',{store.ToString()},'Склад');
            INSERT INTO accounting.partners(id,source_account,source_id,title,details) VALUES
              ({a},'test',{a.ToString()},'Клієнт А',jsonb_build_object()),({b},'test',{b.ToString()},'Клієнт Б',jsonb_build_object());
            INSERT INTO accounting.warehouse_stock(org_id,store_id,product_id,quantity) VALUES ({org},{store},{product.Id},5);
            UPDATE catalog.product_stock SET warehouse_org_id=CASE WHEN {linkedWarehouse} THEN {org} END,
              warehouse_store_id=CASE WHEN {linkedWarehouse} THEN {store} END WHERE product_id={product.Id};
            INSERT INTO accounting.recommendation_offers(id,partner_id,product_id,last_purchase,quantity,unit,price,status)
            VALUES ({first},{a},{product.Id},{last},1.5,'кг',12.50,'offered'),({second},{b},{product.Id},{last},3.5,'кг',18,'offered')
            """,ct));
        Task<HttpResponseMessage> Act(Guid id, string action, object body) => staff.PutAsJsonAsync(Route+id+"/"+action,body,ct);
        Task<decimal> Reserved() => api.WithDbAsync(db => db.Set<ProductStock>().Where(s=>s.ProductId==product.Id)
            .Select(s=>s.ReservedQuantity).SingleAsync(ct));
        async Task<Guid> Draft(Guid id)
        {
            var result = await Act(id, "invoice", linkedWarehouse ? new {} : (object)new { organizationId=org,storeId=store });
            return await result.ReadAsync<Guid>();
        }
        (await Act(first,"invoice",new {})).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(first,"accept",new {})).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(second,"accept",new {})).StatusCode.ShouldBe(HttpStatusCode.OK);
        if (!linkedWarehouse) (await Act(first,"invoice",new {})).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var created = await Task.WhenAll(Draft(first), Draft(first));
        created[0].ShouldBe(created[1]);
        var invoice = created[0];
        var url = Accounting+"documents/"+invoice;
        var card = await staff.ReadAsync<DocumentCard>(url);
        card.Document.PartnerId.ShouldBe(a);
        card.Document.Status.ShouldBe("draft");
        var line = card.Lines.Single();
        line.CatalogId.ShouldBe(product.Id);
        decimal.Parse(line.Price!,System.Globalization.CultureInfo.InvariantCulture).ShouldBe(12.5m);
        decimal.Parse(line.Quantity!,System.Globalization.CultureInfo.InvariantCulture).ShouldBe(1.5m);
        (await Reserved()).ShouldBe(5m);
        var state = await staff.ReadAsync<InvoiceState>(url+"/operations");
        state.OfferReservation.ShouldBe(new InvoiceOfferReservation(1.5m,"кг"));
        var confirmation = new PostInvoice(state.Revision);
        var bad = new NewDraft(invoice,b,"out","Підміна",last,org.ToString(),store.ToString(),[new(product.Id,1.5m,12.5m)]);
        (await staff.PutAsJsonAsync(Accounting+"drafts/"+invoice,new DraftChange(state.Revision,bad),ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await staff.PutAsJsonAsync(Accounting+"drafts/"+invoice,new DraftChange(state.Revision,bad with {
            PartnerId=a, Lines=[new(product.Id,1,12.5m)] }),ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        if (linkedWarehouse)
        {
            var unrelated = bad with { Id=Guid.NewGuid(), Day=card.Document.Day!.Value, Number="Інша накладна" };
            (await staff.PostAsJsonAsync(Accounting+"drafts",unrelated,ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
            var unrelatedUrl = Accounting+"documents/"+unrelated.Id;
            var unrelatedState = await staff.ReadAsync<InvoiceState>(unrelatedUrl+"/operations");
            (await staff.PostAsJsonAsync(unrelatedUrl+"/post",new PostInvoice(unrelatedState.Revision),ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
            // A later stock guard fails after the offer deduction. Both the deduction and offer transition must roll back.
            await api.WithDbAsync(db=>db.Database.ExecuteSqlAsync($"UPDATE accounting.warehouse_stock SET quantity=4 WHERE product_id={product.Id}",ct));
            (await staff.PostAsJsonAsync(url+"/post",confirmation,ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
            (await Reserved()).ShouldBe(5m);
            await api.WithDbAsync(db=>db.Database.ExecuteSqlAsync($"UPDATE accounting.warehouse_stock SET quantity=5 WHERE product_id={product.Id}",ct));
        }
        var posts = await Task.WhenAll(staff.PostAsJsonAsync(url+"/post",confirmation,ct), staff.PostAsJsonAsync(url+"/post",confirmation,ct));
        posts.ShouldAllBe(r=>r.StatusCode==HttpStatusCode.OK);
        (await Draft(first)).ShouldBe(invoice);
        (await Reserved()).ShouldBe(3.5m);
        (await api.WithDbAsync(db=>db.Set<ProductStock>().Where(s=>s.ProductId==product.Id).Select(s=>s.Quantity).SingleAsync(ct))).ShouldBe(3.5m);
        (await staff.ReadAsync<InvoiceState>(url+"/operations")).Stock.Single().After.ShouldBe(3.5m);
        (await api.WithDbAsync(db=>db.Database.SqlQuery<string>($"SELECT status AS \"Value\" FROM accounting.recommendation_offers WHERE id={first}").SingleAsync(ct))).ShouldBe("fulfilled");
        (await Act(first,"release",new {})).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var cancelled = await Draft(second);
        (await Act(second,"release",new {})).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(second,"release",new {})).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Reserved()).ShouldBe(0);
        var cancelledUrl = Accounting+"documents/"+cancelled;
        var cancelledState = await staff.ReadAsync<InvoiceState>(cancelledUrl+"/operations");
        cancelledState.Status.ShouldBe("cancelled");
        (await staff.PostAsJsonAsync(cancelledUrl+"/post",new PostInvoice(cancelledState.Revision),ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Accepting_an_offer_says_whether_the_product_was_archived_or_stock_ran_short()
    {
        var ct = TestContext.Current.CancellationToken;
        using var staff = await Staff.AdminAsync(api);
        var archived = await api.AddProductAsync("ruchnyi-instrument", "Товар, знятий з продажу", 50m, 5m);
        var scarce = await api.AddProductAsync("ruchnyi-instrument", "Товар, якого бракує", 50m, 1m);
        var partner = Guid.NewGuid();
        var gone = Guid.NewGuid();
        var shortOf = Guid.NewGuid();
        var last = new DateOnly(2026, 10, 1);
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.partners(id,source_account,source_id,title,details)
            VALUES ({partner},'archive-test',{partner.ToString()},'Клієнт',jsonb_build_object());
            INSERT INTO accounting.recommendation_offers(id,partner_id,product_id,last_purchase,quantity,unit,price,status)
            VALUES ({gone},{partner},{archived.Id},{last},2,'шт',50,'offered'),({shortOf},{partner},{scarce.Id},{last},2,'шт',50,'offered');
            UPDATE catalog.products SET is_archived=true,is_visible=false WHERE id={archived.Id}
            """, ct));
        async Task<string?> Refusal(Guid id)
        {
            var response = await staff.PutAsJsonAsync(Route + id + "/accept", new { }, ct);
            response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            return (await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(ct)).GetProperty("title").GetString();
        }

        (await Refusal(gone)).ShouldBe("Товар перенесено в архів, тому резерв не створено. Поверніть товар з архіву або позначте, що клієнт відмовився.");
        (await Refusal(shortOf)).ShouldBe("Для погодженої кількості бракує вільного залишку. Резерв не створено.");
        (await api.WithDbAsync(db => db.Set<ProductStock>().Where(s => s.ProductId == archived.Id || s.ProductId == scarce.Id)
            .SumAsync(s => s.ReservedQuantity, ct))).ShouldBe(0);
    }

    private sealed record OfferState(string Status, decimal Quantity, decimal Price, Guid? InvoiceId);

    [Fact]
    public async Task A_pending_offer_can_be_changed_and_a_closed_one_brought_back_without_touching_reservations()
    {
        var ct = TestContext.Current.CancellationToken;
        using var staff = await Staff.AdminAsync(api);
        var product = await api.AddProductAsync("ruchnyi-instrument", "Товар із поверненою пропозицією", 40m, 3m);
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var first = Guid.NewGuid();
        var other = Guid.NewGuid();
        var later = Guid.NewGuid();
        var draft = Guid.NewGuid();
        var last = new DateOnly(2026, 9, 1);
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.partners(id,source_account,source_id,title,details) VALUES
              ({a},'reopen-test',{a.ToString()},'Клієнт А',jsonb_build_object()),({b},'reopen-test',{b.ToString()},'Клієнт Б',jsonb_build_object());
            INSERT INTO accounting.recommendation_offers(id,partner_id,product_id,last_purchase,quantity,unit,price,status)
            VALUES ({first},{a},{product.Id},{last},3,'шт',35,'offered')
            """, ct));
        Task<HttpResponseMessage> Act(Guid id, string action, object body) => staff.PutAsJsonAsync(Route + id + "/" + action, body, ct);
        Task<decimal> Reserved() => api.WithDbAsync(db => db.Set<ProductStock>().Where(s => s.ProductId == product.Id)
            .Select(s => s.ReservedQuantity).SingleAsync(ct));
        Task<OfferState> State(Guid id) => api.WithDbAsync(db => db.Database.SqlQuery<OfferState>(
            $"SELECT status,quantity,price,invoice_id FROM accounting.recommendation_offers WHERE id={id}").SingleAsync(ct));
        Task OnHand(decimal quantity) => api.WithDbAsync(db => db.Set<ProductStock>().Where(s => s.ProductId == product.Id)
            .ExecuteUpdateAsync(v => v.SetProperty(s => s.Quantity, quantity), ct));

        // Someone else bought one unit: the three offered units can no longer be reserved, two can.
        await OnHand(2m);
        (await Act(first, "accept", new { })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(first, "quantity", new { quantity = 0 })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await Act(first, "quantity", new { quantity = 2.5m })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(first, "quantity", new { quantity = 2.5m })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(first, "quantity", new { quantity = 2.75m })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(first, "quantity", new { quantity = 2 })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await State(first)).ShouldBe(new OfferState("offered", 2m, 35m, null));
        (await Reserved()).ShouldBe(0);
        (await Act(first, "accept", new { })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Reserved()).ShouldBe(2m);
        (await Act(first, "quantity", new { quantity = 1 })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(first, "reopen", new { quantity = 1 })).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // The reservation was released by mistake. The offer comes back at today's price and holds no reservation.
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.documents(id,source_account,source_id,entity_type,kind,status,store_ids,details)
            VALUES ({draft},'polivalko-native',{draft.ToString()},'invoice','out','cancelled',ARRAY[]::text[],jsonb_build_object());
            UPDATE accounting.recommendation_offers SET invoice_id={draft} WHERE id={first}
            """, ct));
        (await Act(first, "release", new { })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.recommendation_offers SET status='released' WHERE id={first};
            UPDATE catalog.product_stock SET reserved_quantity=0 WHERE product_id={product.Id}
            """, ct));
        (await Act(first, "reopen", new { quantity = 2.5m })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(first, "reopen", new { quantity = 2 })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(first, "reopen", new { quantity = 2 })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await State(first)).ShouldBe(new OfferState("offered", 2m, 40m, null));
        (await Reserved()).ShouldBe(0);
        (await api.WithDbAsync(db => db.Database.SqlQuery<string>($"SELECT status AS \"Value\" FROM accounting.documents WHERE id={draft}").SingleAsync(ct))).ShouldBe("cancelled");

        // Stock promised to another customer's unanswered offer is not free for an offer that comes back.
        (await Act(first, "decline", new { })).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.recommendation_offers(id,partner_id,product_id,last_purchase,quantity,unit,price,status)
            VALUES ({other},{b},{product.Id},{last},1.5,'шт',40,'offered')
            """, ct));
        (await Act(first, "reopen", new { quantity = 1 })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(first, "reopen", new { quantity = 0.5m })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(other, "quantity", new { quantity = 1.75m })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(other, "quantity", new { quantity = 1 })).StatusCode.ShouldBe(HttpStatusCode.OK);

        // One customer has one open offer for a product: an older closed one cannot come back beside it.
        (await Act(first, "decline", new { })).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.recommendation_offers(id,partner_id,product_id,last_purchase,quantity,unit,price,status)
            VALUES ({later},{a},{product.Id},{last.AddDays(30)},0.5,'шт',40,'offered')
            """, ct));
        (await Act(first, "reopen", new { quantity = 0.5m })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await State(first)).Status.ShouldBe("declined");
        (await Act(Guid.NewGuid(), "reopen", new { quantity = 1 })).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        using var admin = await Staff.AdminAsync(api);
        using var editor = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.AccountingView,
            PermissionKeys.ProductsView, PermissionKeys.ProductAnalyticsView, PermissionKeys.AccountingEdit);
        (await editor.PutAsJsonAsync(Route + later + "/quantity", new { quantity = 0.25m }, ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        using var viewer = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.AccountingView,
            PermissionKeys.ProductsView, PermissionKeys.ProductAnalyticsView);
        (await viewer.PutAsJsonAsync(Route + later + "/quantity", new { quantity = 0.5m }, ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Issuing_declining_and_reserving_are_shared_atomic_and_retryable()
    {
        var ct = TestContext.Current.CancellationToken;
        var first = Guid.NewGuid();
        var next = Guid.NewGuid();
        var product = await api.AddProductAsync("ruchnyi-instrument","Пропозиція · ваговий товар",10,1.5m);
        var last = new DateOnly(2026,11,11);
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.partners(id,source_account,source_id,title,details)
            VALUES ({first},'rec-test',{first.ToString()},'A',jsonb_build_object()),({next},'rec-test',{next.ToString()},'B',jsonb_build_object())
            """,ct));
        var report = new { clients = new[] { first, next }.Select(id => new { id, items = new[]{
            new { id=product.Id, last, quantity=1.5m, price=10m, unit="кг", offerId=(Guid?)null } } }) };
        await using var host = api.WithWebHostBuilder(b => b.ConfigureServices(s =>
            s.AddHttpClient<BusinessAnalyticsClient>(h => h.BaseAddress = new Uri("http://analytics.test/"))
                .ConfigurePrimaryHttpMessageHandler(() => new Report(report))));
        using var staff = host.CreateClient();
        (await staff.PostAsJsonAsync("/api/v1/console/auth/login",new LoginRequest(ApiFactory.AdminEmail,ApiFactory.TestPassword),ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        var csrf = await staff.ReadAsync<CsrfTokenDto>("/api/v1/console/auth/csrf");
        staff.DefaultRequestHeaders.Add("X-CSRF-TOKEN",csrf.Token);
        Task<HttpResponseMessage> Act(string path) => staff.PutAsJsonAsync(Route+path,new {},ct);
        Task<decimal> Reserved() => api.WithDbAsync(db => db.Set<ProductStock>().Where(s => s.ProductId == product.Id)
            .Select(s => s.ReservedQuantity).SingleAsync(ct));
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var input = new RecommendationOfferRequest(first,product.Id,last,90,1.5m,"кг",10m);
        (await staff.PutAsJsonAsync(Route+a,input with { Quantity=2 },ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await staff.PutAsJsonAsync(Route+a,input,ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await staff.PutAsJsonAsync(Route+a,input,ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Reserved()).ShouldBe(0);
        (await staff.PutAsJsonAsync(Route+b,input with { PartnerId=next },ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(a+"/decline")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(a+"/decline")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(a+"/accept")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await staff.PutAsJsonAsync(Route+b,input with { PartnerId=next },ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.WithDbAsync(db => db.Set<ProductStock>().Where(s=>s.ProductId==product.Id)
            .ExecuteUpdateAsync(v=>v.SetProperty(s=>s.Quantity,1m),ct));
        (await Act(b+"/accept")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Reserved()).ShouldBe(0);
        await api.WithDbAsync(db => db.Set<ProductStock>().Where(s=>s.ProductId==product.Id)
            .ExecuteUpdateAsync(v=>v.SetProperty(s=>s.Quantity,1.5m),ct));
        var accepts = await Task.WhenAll(Act(b+"/accept"), Act(b+"/accept"));
        accepts.ShouldAllBe(r=>r.StatusCode==HttpStatusCode.OK);
        (await Reserved()).ShouldBe(1.5m);
        (await Act(b+"/release")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(b+"/release")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Reserved()).ShouldBe(0);
        using var admin = await Staff.AdminAsync(api);
        using var reader = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.AccountingView,
            PermissionKeys.ProductsView, PermissionKeys.ProductAnalyticsView, PermissionKeys.AccountingEdit);
        (await reader.PutAsJsonAsync(Route+b+"/accept",new {},ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
