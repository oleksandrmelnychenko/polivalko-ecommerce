namespace PoliValko.SharedKernel;

public static class KyivTime
{
    public static TimeZoneInfo Zone { get; } = Resolve();

    public static DateOnly Today(TimeProvider time) => DateOf(time.GetUtcNow());

    public static DateOnly DateOf(DateTimeOffset instant) => DateOnly.FromDateTime(ToLocal(instant).DateTime);

    public static DateTimeOffset ToLocal(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, Zone);

    public static DateTimeOffset StartOfDay(DateOnly date)
    {
        var local = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, Zone.GetUtcOffset(local)).ToUniversalTime();
    }

    private static TimeZoneInfo Resolve()
    {
        foreach (var id in new[] { "Europe/Kyiv", "Europe/Kiev", "FLE Standard Time" })
        {
            if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone))
            {
                return zone;
            }
        }

        var rule = TimeZoneInfo.AdjustmentRule.CreateAdjustmentRule(
            DateTime.MinValue.Date,
            DateTime.MaxValue.Date,
            TimeSpan.FromHours(1),
            TimeZoneInfo.TransitionTime.CreateFloatingDateRule(new DateTime(1, 1, 1, 3, 0, 0), 3, 5, DayOfWeek.Sunday),
            TimeZoneInfo.TransitionTime.CreateFloatingDateRule(new DateTime(1, 1, 1, 4, 0, 0), 10, 5, DayOfWeek.Sunday));
        return TimeZoneInfo.CreateCustomTimeZone("Europe/Kyiv", TimeSpan.FromHours(2), "Київ", "EET", "EEST", [rule]);
    }
}
