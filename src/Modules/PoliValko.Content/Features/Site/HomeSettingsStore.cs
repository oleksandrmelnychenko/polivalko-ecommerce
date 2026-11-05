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
            new("Доставка по Україні", "У відділення, поштомат або кур'єром. Вартість — за тарифами Нової пошти"),
            new("Самовивіз у Бучі", "Безкоштовно. Приїжджайте, щойно менеджер підтвердить, що замовлення зібране"),
            new("Оплата як зручно", "Карткою онлайн, післяплатою у відділенні або в магазині"),
            new("Ціна без сюрпризів", "Перед підтвердженням звіряємо ціну й залишок зі складом магазину"),
        ],
        [
            new("Оберіть товари", "Шукайте за назвою чи артикулом або гортайте розділи: полив, інструмент, техніка, усе для рослин."),
            new("Оформіть без реєстрації", "Потрібні лише ім'я й телефон. Ціну й наявність ми ще раз звіримо перед підтвердженням."),
            new("Отримайте замовлення", "Новою поштою у відділенні, поштоматі чи кур'єром — або заберіть самі в магазині в Бучі."),
        ],
        new HomeItemDto("Магазин у Бучі", "Подивіться товар наживо й заберіть замовлення"));

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
