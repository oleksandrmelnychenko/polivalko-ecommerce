using PoliValko.Infrastructure.Settings;

namespace PoliValko.Content.Features.Site;

internal static class HomeSettingsStore
{
    public const string SettingsKey = "site.home";

    public const int MaxItems = 6;

    public static readonly IReadOnlyList<string> BlockKeys = ["hero", "offers", "collections", "categories", "perks", "services", "steps", "visit"];

    public static HomeSettingsDto Defaults { get; } = new(
        BlockKeys.Select(k => new HomeBlockDto(k, true)).ToList(),
        new HomeAnnouncementDto(string.Empty, null, false, null, null),
        [
            new("Доставка по Україні", "Нова пошта: відділення, поштомат або кур'єр. Доставку оплачуєте за тарифами перевізника."),
            new("Самовивіз", "Безкоштовно. Забирайте, коли менеджер повідомить, що замовлення зібране."),
            new("Оплата", "Карткою на сайті, післяплатою на Новій пошті або в магазині."),
            new("Звіряємо зі складом", "Ціну й залишок перевіряємо в магазині до того, як підтвердити замовлення."),
        ],
        [
            new("Оберіть товари", "Знайдіть товар за назвою чи артикулом або відкрийте потрібний розділ каталогу."),
            new("Оформіть без реєстрації", "Достатньо імені й телефону. Ціну й залишок звіримо зі складом перед підтвердженням."),
            new("Отримайте замовлення", "Новою поштою в будь-якому місті України. Або заберіть самі з магазину, це безкоштовно."),
        ],
        new HomeItemDto("Наш магазин", "Товар можна подивитися перед покупкою, а замовлення забрати безкоштовно."));

    public static async Task<HomeSettingsDto> LoadAsync(ISettingsStore settings, CancellationToken ct) =>
        Normalize(await settings.GetAsync<HomeSettingsDto>(SettingsKey, ct) ?? Defaults);

    public static HomeSettingsDto Normalize(HomeSettingsDto value)
    {
        var blocks = (value.Blocks ?? [])
            .Where(b => b is not null && BlockKeys.Contains(b.Key))
            .DistinctBy(b => b.Key)
            .ToList();
        blocks.AddRange(BlockKeys.Where(k => blocks.All(b => b.Key != k)).Select(k => new HomeBlockDto(k, true)));
        var announcement = value.Announcement ?? Defaults.Announcement;
        return new HomeSettingsDto(
            blocks,
            announcement with { Text = announcement.Text ?? string.Empty },
            Items(value.Perks),
            Items(value.Steps),
            value.Visit is null ? Defaults.Visit : Item(value.Visit));
    }

    public static bool IsLive(HomeAnnouncementDto announcement, DateTimeOffset now) =>
        announcement.IsActive
        && !string.IsNullOrWhiteSpace(announcement.Text)
        && (announcement.StartsAt is null || announcement.StartsAt <= now)
        && (announcement.EndsAt is null || announcement.EndsAt >= now);

    private static List<HomeItemDto> Items(IReadOnlyList<HomeItemDto>? items) =>
        (items ?? []).Where(i => i is not null).Select(Item).ToList();

    private static HomeItemDto Item(HomeItemDto item) => new(item.Title ?? string.Empty, item.Text ?? string.Empty);
}
