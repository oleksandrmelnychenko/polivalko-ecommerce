using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Catalog.Features.Admin.AttributeNames;
using PoliValko.Catalog.Features.Admin.Categories;
using PoliValko.Catalog.Features.Admin.Collections;
using PoliValko.Catalog.Features.Admin.Products;
using PoliValko.Catalog.Features.Admin.Redirects;

namespace PoliValko.Catalog.Features.Admin;

internal static class AdminCatalogEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        var catalog = admin.MapGroup("/catalog").WithTags("Admin");

        ProductEndpoints.Map(catalog);
        AttributeNameEndpoints.Map(catalog);
        CategoryEndpoints.Map(catalog);
        CollectionEndpoints.Map(catalog);
        RedirectEndpoints.Map(catalog);

        return admin;
    }
}
