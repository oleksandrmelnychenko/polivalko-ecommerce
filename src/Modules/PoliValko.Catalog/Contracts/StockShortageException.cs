namespace PoliValko.Catalog.Contracts;

public sealed class StockShortageException(string message) : InvalidOperationException(message);
