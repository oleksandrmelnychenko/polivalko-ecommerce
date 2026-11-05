using Microsoft.AspNetCore.Authorization;

namespace PoliValko.Infrastructure.Security.Permissions;

public sealed class PermissionRequirement(IReadOnlyList<string> anyOf) : IAuthorizationRequirement
{
    public const string PolicyPrefix = "permission:";

    public const char Separator = '|';

    public IReadOnlyList<string> AnyOf { get; } = anyOf;

    public static string PolicyName(IEnumerable<string> anyOf)
    {
        var keys = anyOf.ToList();
        if (keys.Count == 0)
        {
            throw new ArgumentException("Потрібен хоча б один ключ права.", nameof(anyOf));
        }

        foreach (var key in keys)
        {
            if (!PermissionCatalog.Contains(key))
            {
                throw new ArgumentException($"Ключа права {key} немає в каталозі.", nameof(anyOf));
            }
        }

        return PolicyPrefix + string.Join(Separator, keys);
    }
}
