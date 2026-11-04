using PoliValko.Catalog.Features.Console.Products;

namespace PoliValko.Catalog.Features.Console.Collections;

public sealed record ConsoleCollectionDto(
    Guid Id,
    string Code,
    string Title,
    int SortOrder,
    bool IsVisible,
    IReadOnlyList<ConsoleProductListItemDto> Products);

public sealed record SaveCollectionRequest(string? Code, string? Title, int SortOrder, bool IsVisible, IReadOnlyList<Guid>? ProductIds);
