namespace PoliValko.Ordering.Domain;

public static class ShopActivityKinds
{
    public const string CartAdd = "cart_add";
    public const string CartRemove = "cart_remove";
    public const string CompareAdd = "compare_add";
    public const string CompareRemove = "compare_remove";
    public const string FavoriteAdd = "favorite_add";
    public const string FavoriteRemove = "favorite_remove";

    public static bool IsStorefrontSignal(string? kind) =>
        kind is CompareAdd or CompareRemove or FavoriteAdd or FavoriteRemove;
}

public sealed class ShopActivityEvent
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public required string Kind { get; init; }

    public required string VisitorKey { get; init; }

    public required string VisitorTag { get; init; }

    public Guid? CustomerId { get; init; }

    public Guid ProductId { get; init; }

    public int Quantity { get; init; } = 1;

    public required string Device { get; init; }

    public DateTimeOffset OccurredAt { get; init; }
}
