namespace PoliValko.Delivery.Contracts;

public interface IDeliveryAvailability
{
    Task<DeliveryAvailability> GetAsync(CancellationToken ct);
}
