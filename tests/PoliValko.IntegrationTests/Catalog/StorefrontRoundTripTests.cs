using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;

namespace PoliValko.IntegrationTests;

// A storefront page that misses its cache asks the API, and every SQL command the API sends then is a round trip to
// a database a network hop away. The ceilings keep those round trips from creeping back one by one.
public sealed class StorefrontRoundTripTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Storefront_reads_send_few_sql_commands()
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var group = $"round-trip-{token}";
        var small = await api.AddProductAsync("vse-dlia-roslyn", $"Насіння {token}", 30m, brand: "Florovit");
        var large = await api.AddProductAsync("vse-dlia-roslyn", $"Насіння {token} велике", 60m, brand: "Florovit");
        await api.WithDbAsync(async db =>
        {
            await db.Set<Product>().Where(p => p.Id == small.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.VariantGroup, group).SetProperty(p => p.VariantLabel, "1 г"), Ct);
            await db.Set<Product>().Where(p => p.Id == large.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.VariantGroup, group).SetProperty(p => p.VariantLabel, "5 г"), Ct);
            db.Add(new ProductImage { Id = Guid.CreateVersion7(), ProductId = small.Id, Url = "https://example.test/seed.jpg", Alt = "Насіння", SortOrder = 0 });
            return await db.SaveChangesAsync(Ct);
        });

        (int Ceiling, string Url)[] reads =
        [
            (9, "/api/v1/products?category=vse-dlia-roslyn&pageSize=24"),
            (10, "/api/v1/products?pageSize=24"),
            (8, "/api/v1/products?category=vse-dlia-roslyn&sort=price_asc&pageSize=24"),
            (9, $"/api/v1/products?q={token}&sort=price_asc&pageSize=24"),
            (8, $"/api/v1/products/{small.Slug}"),
            (1, "/api/v1/categories"),
            (4, "/api/v1/catalog/brands"),
        ];

        var client = api.CreateClient();
        var report = new List<string>();
        var over = false;
        foreach (var (ceiling, url) in reads)
        {
            // The first call fills the in-memory answers the seasonal sort keeps; the second is the steady state.
            await SendAsync(client, url, $"{token}-warm-{url}");
            var key = $"{token}-{url}";
            await SendAsync(client, url, key);
            var count = SqlCommandCounter.Of(key);
            over |= count > ceiling;
            report.Add($"{count,3} (ceiling {ceiling,2})  {url}");
        }

        var lines = Environment.NewLine + string.Join(Environment.NewLine, report);
        TestContext.Current.TestOutputHelper?.WriteLine(lines);
        over.ShouldBeFalse(lines);
    }

    private static async Task SendAsync(HttpClient client, string url, string key)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add(SqlCommandCounter.Header, key);
        using var response = await client.SendAsync(request, Ct);
        response.EnsureSuccessStatusCode();
    }
}
