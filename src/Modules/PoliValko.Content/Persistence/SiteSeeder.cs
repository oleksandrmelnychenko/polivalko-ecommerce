using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Content.Features.Site;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Content.Persistence;

internal static class SiteSeeder
{
    public const string SeedActor = "Початкові дані";

    public static async Task SeedAsync(PoliValkoDbContext db, ISettingsStore settings, TimeProvider time, CancellationToken ct)
    {
        if (await settings.GetAsync<JsonElement?>(HomeSettingsStore.SettingsKey, ct) is null)
        {
            if (!await db.Set<Banner>().AnyAsync(ct))
            {
                db.AddRange(Banners(time.GetUtcNow()));
            }

            await settings.SaveAsync(HomeSettingsStore.SettingsKey, HomeSettingsStore.Defaults, SeedActor, ct);
        }

        if (await settings.GetAsync<JsonElement?>(SeoTemplateSettings.SettingsKey, ct) is null)
        {
            await settings.SaveAsync(SeoTemplateSettings.SettingsKey, SeoTemplateSettings.Defaults, SeedActor, ct);
        }
    }

    private static Banner[] Banners(DateTimeOffset now) =>
    [
        new()
        {
            Id = Guid.CreateVersion7(now),
            Title = "Товари для саду, городу й дому",
            Text = "Відправляємо Новою поштою по всій Україні. Самовивіз з магазину безкоштовний.",
            ButtonLabel = "Перейти до каталогу",
            Link = "/catalog",
            ImageUrl = "https://images.unsplash.com/photo-1719324923613-ff0884b031ed?auto=format&fit=crop&q=80&w=1200",
            SortOrder = 1,
            IsActive = true,
            UpdatedAt = now,
        },
        new()
        {
            Id = Guid.CreateVersion7(now.AddTicks(1)),
            Kicker = "Хіт продажів",
            Title = "Найчастіше купують",
            ButtonLabel = "Переглянути товар",
            Link = "/bestseller",
            ImageUrl = "https://images.unsplash.com/photo-1729603596055-22a2c182903b?auto=format&fit=crop&q=80&w=1200",
            SortOrder = 2,
            IsActive = true,
            UpdatedAt = now,
        },
        new()
        {
            Id = Guid.CreateVersion7(now.AddTicks(2)),
            Kicker = "Новий рік",
            Title = "Готуємося до свят",
            Text = "Ялинки, гірлянди й прикраси. Відправляємо Новою поштою по всій Україні.",
            ButtonLabel = "Усе до Нового року",
            Link = "/catalog/novyi-rik",
            ImageUrl = "https://images.unsplash.com/photo-1482517967863-00e15c9b44be?auto=format&fit=crop&q=80&w=1200",
            StartsAt = NewYearSeason(now).StartsAt,
            EndsAt = NewYearSeason(now).EndsAt,
            SortOrder = 3,
            IsActive = true,
            UpdatedAt = now,
        },
    ];

    private static (DateTimeOffset StartsAt, DateTimeOffset EndsAt) NewYearSeason(DateTimeOffset now)
    {
        var kyiv = TimeSpan.FromHours(2);
        var endYear = now.Month == 1 && now.Day < 8 ? now.Year : now.Year + 1;
        return (new DateTimeOffset(endYear - 1, 11, 1, 0, 0, 0, kyiv), new DateTimeOffset(endYear, 1, 8, 0, 0, 0, kyiv));
    }
}
