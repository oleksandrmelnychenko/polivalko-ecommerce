namespace PoliValko.SharedKernel;

/// <summary>
/// Робочий час магазину — київський. Межі «дня» у звітах адмінки й фільтрах за датою рахуються
/// за Києвом, а не за UTC: замовлення о 01:30 за Києвом належить новому дню, хоча в UTC ще вчора.
/// </summary>
public static class KyivTime
{
    /// <summary>Часовий пояс Києва з урахуванням переходу на літній час.</summary>
    public static TimeZoneInfo Zone { get; } = Resolve();

    /// <summary>Поточна дата за Києвом.</summary>
    public static DateOnly Today(TimeProvider time) => DateOf(time.GetUtcNow());

    /// <summary>Дата моменту часу за Києвом.</summary>
    public static DateOnly DateOf(DateTimeOffset instant) => DateOnly.FromDateTime(ToLocal(instant).DateTime);

    /// <summary>Момент часу в київському часі (зі зміщенням +02:00 або +03:00).</summary>
    public static DateTimeOffset ToLocal(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, Zone);

    /// <summary>
    /// Початок доби за Києвом як момент в UTC. PostgreSQL (timestamptz через Npgsql) приймає лише
    /// значення зі зміщенням 0, тому межі для запитів завжди в UTC. Перехід на літній час відбувається
    /// о 03:00–04:00, тож північ завжди існує й однозначна.
    /// </summary>
    public static DateTimeOffset StartOfDay(DateOnly date)
    {
        var local = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, Zone.GetUtcOffset(local)).ToUniversalTime();
    }

    private static TimeZoneInfo Resolve()
    {
        // IANA-ідентифікатор у Linux-контейнері; старі бази tzdata знають лише Europe/Kiev; у Windows — FLE Standard Time.
        foreach (var id in new[] { "Europe/Kyiv", "Europe/Kiev", "FLE Standard Time" })
        {
            if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone))
            {
                return zone;
            }
        }

        // Без бази часових поясів в образі: EET/EEST за правилами ЄС (остання неділя березня й жовтня).
        var rule = TimeZoneInfo.AdjustmentRule.CreateAdjustmentRule(
            DateTime.MinValue.Date,
            DateTime.MaxValue.Date,
            TimeSpan.FromHours(1),
            TimeZoneInfo.TransitionTime.CreateFloatingDateRule(new DateTime(1, 1, 1, 3, 0, 0), 3, 5, DayOfWeek.Sunday),
            TimeZoneInfo.TransitionTime.CreateFloatingDateRule(new DateTime(1, 1, 1, 4, 0, 0), 10, 5, DayOfWeek.Sunday));
        return TimeZoneInfo.CreateCustomTimeZone("Europe/Kyiv", TimeSpan.FromHours(2), "Київ", "EET", "EEST", [rule]);
    }
}
