namespace PoliValko.Ordering.Contracts;

public static class OrderStatusCounts
{
    public static IReadOnlyList<OrderStatusCountDto> From(IEnumerable<(OrderStatus Status, int Count)> counts) =>
        counts.Where(c => c.Count > 0)
            .OrderBy(c => c.Status)
            .Select(c => new OrderStatusCountDto(c.Status, c.Count))
            .ToList();
}
