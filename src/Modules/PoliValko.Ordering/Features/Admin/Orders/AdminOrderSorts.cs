namespace PoliValko.Ordering.Features.Admin.Orders;

public static class AdminOrderSorts
{
    public const string Newest = "newest";
    public const string Oldest = "oldest";
    public const string TotalDesc = "totalDesc";
    public const string TotalAsc = "totalAsc";

    public static readonly IReadOnlyList<string> All = [Newest, Oldest, TotalDesc, TotalAsc];
}
