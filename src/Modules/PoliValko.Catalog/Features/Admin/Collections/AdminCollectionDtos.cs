using PoliValko.Catalog.Features.Admin.Products;

namespace PoliValko.Catalog.Features.Admin.Collections;

public sealed record AdminCollectionDto(
    Guid Id,
    string Code,
    string Title,
    int SortOrder,
    bool IsVisible,
    IReadOnlyList<AdminProductListItemDto> Products);

public sealed record SaveCollectionRequest(string? Code, string? Title, int SortOrder, bool IsVisible, IReadOnlyList<Guid>? ProductIds);
