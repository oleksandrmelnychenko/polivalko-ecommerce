namespace PoliValko.Ordering.Features.Console.Orders;

public static class ConsoleOrderSorts
{
    public const string Newest = "newest";
    public const string Oldest = "oldest";
    public const string TotalDesc = "totalDesc";
    public const string TotalAsc = "totalAsc";

    public static readonly IReadOnlyList<string> All = [Newest, Oldest, TotalDesc, TotalAsc];
}
