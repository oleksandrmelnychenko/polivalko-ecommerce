namespace PoliValko.Ordering.Contracts;

public sealed record OrderSearchHit(string Number, string CustomerName, string CustomerPhone, OrderStatus Status, decimal Total, DateTimeOffset CreatedAt);
