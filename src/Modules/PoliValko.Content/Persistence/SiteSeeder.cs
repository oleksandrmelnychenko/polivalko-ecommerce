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
            Kicker = "Магазин у Бучі",
            Title = "Усе для саду, городу й дому",
            Text = "Відправимо Новою поштою по всій Україні або підготуємо до самовивозу в Бучі",
            ButtonLabel = "Обрати товари",
            Link = "/catalog",
            ImageUrl = "https://images.unsplash.com/photo-1719324923613-ff0884b031ed?auto=format&fit=crop&q=80&w=1200",
            SortOrder = 1,
            IsActive = true,
            UpdatedAt = now,
        },
        new()
        {
            Id = Guid.CreateVersion7(now.AddTicks(1)),
            Kicker = "Зараз дешевше",
            Title = "Знижки для саду",
            Text = "Полив, інструмент і садова техніка за ціною, нижчою, ніж була",
            ButtonLabel = "Дивитися знижки",
            Link = "/#offers-title",
            ImageUrl = "https://images.unsplash.com/photo-1764046860592-9931f0869fc6?auto=format&fit=crop&q=80&w=1200",
            SortOrder = 2,
            IsActive = true,
            UpdatedAt = now,
        },
    ];
}
