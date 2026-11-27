namespace PoliValko.Catalog.Domain;

public sealed class StockReservation
{
    public Guid OrderId { get; init; }
    public Guid ProductId { get; init; }
    public int Quantity { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
    public bool Consumed { get; set; }
    public Guid? WarehouseOrgId { get; set; }
    public Guid? WarehouseStoreId { get; set; }
    public bool Released { get; set; }
}
