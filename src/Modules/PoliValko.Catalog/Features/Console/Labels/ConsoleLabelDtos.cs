using PoliValko.Catalog.Domain;

namespace PoliValko.Catalog.Features.Console.Labels;

public sealed record LabelDto(
    Guid Id,
    string Name,
    LabelTone Tone,
    LabelKind Kind,
    int? NewDays,
    int SortOrder,
    bool IsActive,
    int ProductCount);

public sealed record SaveLabelRequest(
    string? Name,
    LabelTone? Tone,
    LabelKind? Kind,
    int? NewDays,
    int SortOrder,
    bool IsActive);
