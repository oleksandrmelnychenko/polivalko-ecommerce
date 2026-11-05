using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Catalog.Features.Console.AttributeNames;
using PoliValko.Catalog.Features.Console.Attributes;
using PoliValko.Catalog.Features.Console.Brands;
using PoliValko.Catalog.Features.Console.Categories;
using PoliValko.Catalog.Features.Console.Collections;
using PoliValko.Catalog.Features.Console.Labels;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Catalog.Features.Console.Redirects;

namespace PoliValko.Catalog.Features.Console;

internal static class ConsoleCatalogEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var catalog = console.MapGroup("/catalog").WithTags("Console");

        ProductEndpoints.Map(catalog);
        AttributeNameEndpoints.Map(catalog);
        CategoryEndpoints.Map(catalog);
        CollectionEndpoints.Map(catalog);
        RedirectEndpoints.Map(catalog);
        AttributeEndpoints.Map(catalog);
        BrandEndpoints.Map(catalog);
        LabelEndpoints.Map(catalog);

        return console;
    }
}
