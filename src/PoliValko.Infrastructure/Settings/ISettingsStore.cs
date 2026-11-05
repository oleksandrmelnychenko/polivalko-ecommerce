namespace PoliValko.Infrastructure.Settings;

public interface ISettingsStore
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct);

    Task SaveAsync<T>(string key, T value, string updatedBy, CancellationToken ct);
}
