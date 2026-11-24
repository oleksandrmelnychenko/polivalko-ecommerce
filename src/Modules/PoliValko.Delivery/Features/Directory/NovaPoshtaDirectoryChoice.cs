using PoliValko.Delivery.Contracts;

namespace PoliValko.Delivery.Features.Directory;

public enum NovaPoshtaDirectoryChoice { Api, Demo, Unavailable }

internal static class NovaPoshtaDirectoryChoices
{
    /// <summary>
    /// Without an API key a live shop offers no Nova Poshta branches at all: the demo directory, with ten made-up cities,
    /// would accept orders to branches that do not exist. Development, tests and staging keep it.
    /// </summary>
    public static NovaPoshtaDirectoryChoice For(bool configured, string environment) =>
        configured ? NovaPoshtaDirectoryChoice.Api
        : string.Equals(environment, "Production", StringComparison.OrdinalIgnoreCase) ? NovaPoshtaDirectoryChoice.Unavailable
        : NovaPoshtaDirectoryChoice.Demo;
}

/// <summary>No settlements and no branches: checkout then refuses Nova Poshta and leaves pickup.</summary>
internal sealed class UnavailableNovaPoshtaDirectory : IDeliveryDirectory
{
    public ValueTask<IReadOnlyList<Settlement>> SearchSettlementsAsync(string? query, int limit, CancellationToken ct) => new([]);
    public ValueTask<Settlement?> FindSettlementAsync(string reference, CancellationToken ct) => new((Settlement?)null);
    public ValueTask<IReadOnlyList<Warehouse>?> GetWarehousesAsync(string settlementRef, string? query, CancellationToken ct) => new((IReadOnlyList<Warehouse>?)null);
    public ValueTask<Warehouse?> FindWarehouseAsync(string reference, CancellationToken ct) => new((Warehouse?)null);
}
