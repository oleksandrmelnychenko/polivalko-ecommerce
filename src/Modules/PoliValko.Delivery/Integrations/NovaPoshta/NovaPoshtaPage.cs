namespace PoliValko.Delivery.Integrations.NovaPoshta;

internal sealed record NovaPoshtaPage<T>(IReadOnlyList<T> Items, int RawCount, int? TotalCount);
