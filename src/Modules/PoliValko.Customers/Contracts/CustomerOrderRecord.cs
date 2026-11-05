namespace PoliValko.Customers.Contracts;

public sealed record CustomerOrderRecord(string Number, DateTimeOffset CreatedAt, string Status, decimal Total);
