namespace PoliValko.Infrastructure.Storefront;

public interface IStorefrontCache
{
    Task InvalidateAsync(IReadOnlyCollection<string> tags, CancellationToken ct);
}
