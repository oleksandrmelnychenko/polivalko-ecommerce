using PoliValko.Catalog.Domain;

namespace PoliValko.Catalog.Features.Console.Attributes;

public sealed record AttributeDefinitionDto(
    Guid Id,
    string Name,
    string? Unit,
    AttributeKind Kind,
    AttributeFilterView FilterView,
    int SortOrder,
    IReadOnlyList<string> Aliases,
    int ProductCount,
    int CategoryCount);

public sealed record SaveAttributeDefinitionRequest(
    string? Name,
    string? Unit,
    AttributeKind? Kind,
    AttributeFilterView? FilterView,
    int SortOrder,
    IReadOnlyList<string>? Aliases);
