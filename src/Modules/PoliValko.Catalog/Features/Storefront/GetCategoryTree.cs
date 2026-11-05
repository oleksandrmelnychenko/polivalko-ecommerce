using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

internal static class GetCategoryTree
{
    public static async Task<Ok<IReadOnlyList<CategoryNodeDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
        var byParent = categories.ToLookup(c => c.ParentId);

        IReadOnlyList<CategoryNodeDto> Build(Guid? parentId) =>
            byParent[parentId].Select(c => new CategoryNodeDto(c.Id, c.Slug, c.Name, Build(c.Id), c.ImageUrl, c.Description)).ToList();

        return TypedResults.Ok(Build(null));
    }
}
