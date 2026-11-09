using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.Ordering.Features.Cart;

public sealed record ServerCartDto(Guid Id, long Revision, IReadOnlyList<QuoteLineDto> Items, OrderCreatedDto? LastOrder);
public sealed record SaveCartRequest(Guid CartId, long Revision, IReadOnlyList<CartLineRequest>? Items);
public sealed record CartCheckoutRequest(Guid CartId, long Revision, CreateOrderRequest Order);
