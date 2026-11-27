using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Content.Features.Site;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.SharedKernel;

namespace PoliValko.Content.Persistence;

internal static class SiteSeeder
{
    public const string SeedActor = "Початкові дані";

    public static async Task SeedAsync(PoliValkoDbContext db, ISettingsStore settings, TimeProvider time, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var dirty = false;

        if (await settings.GetAsync<JsonElement?>(HomeSettingsStore.SettingsKey, ct) is null)
        {
            if (!await db.Set<Banner>().AnyAsync(ct))
            {
                db.AddRange(Banners(now));
            }

            await UpgradeDefaultServicesAsync(db, now, ct);
            await settings.SaveAsync(HomeSettingsStore.SettingsKey, HomeSettingsStore.Defaults, SeedActor, ct);
        }

        if (await settings.GetAsync<JsonElement?>(SeoTemplateSettings.SettingsKey, ct) is null)
        {
            await settings.SaveAsync(SeoTemplateSettings.SettingsKey, SeoTemplateSettings.Defaults, SeedActor, ct);
        }

        var contacts = await db.Set<SiteContacts>().FirstOrDefaultAsync(c => c.Id == SiteContacts.SingletonId, ct);
        if (contacts is not null && IsRootSocialPlaceholder(contacts.Facebook))
        {
            contacts.Facebook = null;
            contacts.UpdatedAt = now;
            dirty = true;
        }

        var bannerCandidates = await db.Set<Banner>()
            .Where(b => b.ImageUrl.Contains(LegacyUnsplashPhotoPath))
            .ToListAsync(ct);
        foreach (var banner in bannerCandidates.Where(b => IsLegacyUnsplashBanner(b.ImageUrl)))
        {
            banner.ImageUrl = FallbackBannerImageUrl;
            banner.UpdatedAt = now;
            dirty = true;
        }

        if (dirty)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private const string LegacyUnsplashPhotoPath = "/photo-1764046860592-9931f0869fc6";
    internal const string FallbackBannerImageUrl = "/brand/service-irrigation.webp";

    internal static bool IsLegacyUnsplashBanner(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri)
        && uri.Scheme is "https" or "http"
        && uri.Host.Equals("images.unsplash.com", StringComparison.OrdinalIgnoreCase)
        && uri.AbsolutePath == LegacyUnsplashPhotoPath;

    internal sealed record DefaultServiceSeo(string Description, string SeoTitle, string SeoDescription);

    internal static readonly IReadOnlyDictionary<string, DefaultServiceSeo> DefaultServices = new Dictionary<string, DefaultServiceSeo>
    {
        ["landscape-design"] = new(
            "Проєктування ландшафтного дизайну в Бучі, Ірпені, Гостомелі, Ворзелі та Київській області: зонування, доріжки, освітлення й дендроплан.",
            "Ландшафтний дизайн у Бучі й Ірпені під ключ | Poli Valko",
            "Проєктування ландшафтного дизайну в Бучі, Ірпені, Гостомелі, Ворзелі та Київській області: зонування, доріжки, освітлення й дендроплан у Poli Valko."),
        ["irrigation-installation"] = new(
            "Проєктування й монтаж автополиву під ключ у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області на обладнанні Hunter та Irritec.",
            "Монтаж автополиву в Бучі, Ірпені й Київщині | Poli Valko",
            "Проєктування й монтаж автополиву під ключ у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області на обладнанні Hunter та Irritec. Гарантія Poli Valko."),
        ["greening"] = new(
            "Професійне озеленення у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області: підбір і висадка дерев, кущів і квітників під ваш ґрунт і освітлення.",
            "Озеленення ділянок у Бучі, Ірпені й Київщині | Poli Valko",
            "Професійне озеленення у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області: підбір і висадка дерев, кущів, квітників під ваш ґрунт і освітлення."),
        ["lawns"] = new(
            "Укладання рулонного та посівного газону в Бучі, Ірпені, Гостомелі, Ворзелі та Київській області: підготовка основи, вирівнювання й перший догляд.",
            "Укладання рулонного й посівного газону в Бучі | Poli Valko",
            "Укладання рулонного та посівного газону в Бучі, Ірпені, Гостомелі, Ворзелі та Київській області: підготовка ґрунту, вирівнювання, посів і перший догляд."),
        ["garden-care"] = new(
            "Комплексний сезонний догляд за садом у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області: обрізка, підживлення, аерація газону й прибирання.",
            "Догляд за садом у Бучі, Ірпені й Гостомелі | Poli Valko",
            "Комплексний сезонний догляд за садом у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області: обрізка, підживлення, аерація газону й прибирання."),
        ["irrigation-service"] = new(
            "Весняний запуск, продувка й консервація автополиву на зиму, ремонт форсунок і контролерів у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області.",
            "Сервіс, запуск і консервація автополиву в Бучі | Poli Valko",
            "Весняний запуск, продувка й консервація автополиву на зиму, ремонт форсунок і контролерів у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області."),
        ["plant-treatment"] = new(
            "Професійна обробка саду від шкідників і хвороб у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області сертифікованими препаратами.",
            "Обробка саду й рослин у Бучі та Київщині | Poli Valko",
            "Професійна обробка саду від шкідників і хвороб у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області сертифікованими препаратами. Виїзд Poli Valko."),
    };

    private static async Task UpgradeDefaultServicesAsync(PoliValkoDbContext db, DateTimeOffset now, CancellationToken ct)
    {
        var services = await db.Set<ServiceDirectionContent>().ToListAsync(ct);
        foreach (var service in services)
        {
            if (service.SeoDescription is not null || !DefaultServices.TryGetValue(service.Code, out var defaults))
            {
                continue;
            }

            service.Description = defaults.Description;
            service.SeoTitle = defaults.SeoTitle;
            service.SeoDescription = defaults.SeoDescription;
            service.UpdatedAt = now;
        }
    }

    internal static bool IsRootSocialPlaceholder(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme is not ("https" or "http"))
        {
            return false;
        }

        var host = uri.Host.ToLowerInvariant();
        var isKnownSocialHost = host is "facebook.com" or "www.facebook.com" or "m.facebook.com"
            or "instagram.com" or "www.instagram.com" or "youtube.com" or "www.youtube.com";
        return isKnownSocialHost && uri.AbsolutePath.Trim('/').Length == 0 && string.IsNullOrEmpty(uri.Query);
    }

    internal static Banner[] Banners(DateTimeOffset now) =>
    [
        new()
        {
            Id = Guid.CreateVersion7(now),
            Title = "Товари для саду, городу й дому",
            Text = "Відправляємо Новою поштою по всій Україні. Самовивіз з магазину безкоштовний.",
            ButtonLabel = "Перейти до каталогу",
            Link = "/catalog",
            ImageUrl = "/brand/about-garden.webp",
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
            ImageUrl = "/brand/service-irrigation.webp",
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
            ImageUrl = "/brand/polivalko-bucha.jpg",
            StartsAt = NewYearSeason(now).StartsAt,
            EndsAt = NewYearSeason(now).EndsAt,
            SortOrder = 3,
            IsActive = true,
            UpdatedAt = now,
        },
    ];

    internal static (DateTimeOffset StartsAt, DateTimeOffset EndsAt) NewYearSeason(DateTimeOffset now)
    {
        var today = KyivTime.DateOf(now);
        var endYear = today.Month == 1 && today.Day < 8 ? today.Year : today.Year + 1;
        return (KyivTime.StartOfDay(new DateOnly(endYear - 1, 11, 1)), KyivTime.StartOfDay(new DateOnly(endYear, 1, 8)));
    }
}
