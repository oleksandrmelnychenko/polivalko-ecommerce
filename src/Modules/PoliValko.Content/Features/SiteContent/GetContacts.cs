using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Content.Features.SiteContent;

internal static class GetContacts
{
    public static async Task<Ok<ContactsDto>> HandleAsync(PoliValkoDbContext db, ISettingsStore settings, TimeProvider time, CancellationToken ct)
    {
        var contacts = await db.Set<SiteContacts>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == SiteContacts.SingletonId, ct) ?? new SiteContacts();
        return TypedResults.Ok(SiteContentMapping.ToDto(contacts, await ShopSpecialDays.UpcomingAsync(settings, time, ct)));
    }
}
