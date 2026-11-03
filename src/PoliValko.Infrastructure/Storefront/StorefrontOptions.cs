namespace PoliValko.Infrastructure.Storefront;

public sealed class StorefrontOptions
{
    public string? RevalidateUrl { get; set; }

    public string? RevalidateSecret { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(RevalidateUrl) && !string.IsNullOrWhiteSpace(RevalidateSecret);
}
