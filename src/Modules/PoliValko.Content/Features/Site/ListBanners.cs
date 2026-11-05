using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.Site;

internal static class ListBanners
{
    public static async Task<Ok<List<BannerDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await LoadAsync(db, ct));

    public static async Task<List<BannerDto>> LoadAsync(PoliValkoDbContext db, CancellationToken ct) =>
        (await db.Set<Banner>().AsNoTracking().OrderBy(b => b.SortOrder).ThenBy(b => b.Title).ToListAsync(ct))
        .Select(BannerEditor.ToDto)
        .ToList();
}
