using System.Net;
using System.Net.Http.Json;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Attributes;
using PoliValko.Catalog.Features.Console.Brands;
using PoliValko.Catalog.Features.Console.Labels;

namespace PoliValko.IntegrationTests;

internal static class CatalogDictionaries
{
    public const string Attributes = "/api/v1/console/catalog/attributes";
    public const string Brands = "/api/v1/console/catalog/brands";
    public const string Labels = "/api/v1/console/catalog/labels";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static string Unique(string prefix) => $"{prefix} {Guid.NewGuid().ToString("N")[..6]}";

    public static async Task<AttributeDefinitionDto> EnsureAttributeAsync(HttpClient admin, string name)
    {
        var existing = (await admin.ReadAsync<List<AttributeDefinitionDto>>(Attributes))
            .FirstOrDefault(a => string.Equals(a.Name, name, StringComparison.OrdinalIgnoreCase));
        return existing ?? await (await admin.PostAsJsonAsync(Attributes, new SaveAttributeDefinitionRequest(name, null, null, null, 0, null), TestJson.Options, Ct))
            .ReadAsync<AttributeDefinitionDto>(HttpStatusCode.Created);
    }

    public static async Task<BrandDto> CreateBrandAsync(HttpClient admin, string? name = null) =>
        await (await admin.PostAsJsonAsync(Brands, new SaveBrandRequest(name ?? Unique("Бренд"), null, null, null), TestJson.Options, Ct))
            .ReadAsync<BrandDto>(HttpStatusCode.Created);

    public static async Task<LabelDto> CreateLabelAsync(HttpClient client, string? name = null, LabelTone tone = LabelTone.Blue) =>
        await (await client.PostAsJsonAsync(Labels, new SaveLabelRequest(name ?? $"Мітка {Guid.NewGuid().ToString("N")[..6]}", tone, LabelKind.Manual, null, 10, true), TestJson.Options, Ct))
            .ReadAsync<LabelDto>(HttpStatusCode.Created);

    public static async Task<LabelDto> SeededAsync(HttpClient client, LabelKind kind) =>
        (await client.ReadAsync<List<LabelDto>>(Labels)).First(l => l.Kind == kind && l.Name is "Акція" or "Новинка" or "Хіт");
}
