namespace PoliValko.Content.Domain;

/// <param name="Slug">Default address of the service page (<c>/services/{slug}</c>); the console can override it.</param>
public sealed record ServiceDirection(string Code, string Name, string Slug);
