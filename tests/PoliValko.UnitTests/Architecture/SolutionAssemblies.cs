using System.Reflection;
using PoliValko.Console;
using PoliValko.Catalog;
using PoliValko.Content;
using PoliValko.Delivery;
using PoliValko.Fiscal;
using PoliValko.Identity;
using PoliValko.Infrastructure;
using PoliValko.Navkolo;
using PoliValko.Notifications;
using PoliValko.Ordering;
using PoliValko.Payments;
using PoliValko.SharedKernel;

namespace PoliValko.UnitTests.Architecture;

internal static class SolutionAssemblies
{
    public const string Prefix = "PoliValko.";

    public static readonly IReadOnlyList<Assembly> Modules =
    [
        typeof(ConsoleModule).Assembly,
        typeof(CatalogModule).Assembly,
        typeof(ContentModule).Assembly,
        typeof(DeliveryModule).Assembly,
        typeof(FiscalModule).Assembly,
        typeof(IdentityModule).Assembly,
        typeof(NavkoloModule).Assembly,
        typeof(NotificationsModule).Assembly,
        typeof(OrderingModule).Assembly,
        typeof(PaymentsModule).Assembly,
    ];

    public static readonly Assembly Infrastructure = typeof(PlatformModule).Assembly;

    public static readonly Assembly SharedKernel = typeof(MoneyDto).Assembly;

    public static readonly IReadOnlyList<Assembly> Source = [SharedKernel, Infrastructure, .. Modules];

    public static readonly IReadOnlySet<string> ModuleNames = Modules.Select(Name).ToHashSet(StringComparer.Ordinal);

    public static string Name(Assembly assembly) => assembly.GetName().Name!;

    public static string ShortName(string assemblyName) => assemblyName[Prefix.Length..];

    public static bool IsContractsNamespace(string? ns, string assemblyName) =>
        ns is not null && (ns == $"{assemblyName}.Contracts" || ns.StartsWith($"{assemblyName}.Contracts.", StringComparison.Ordinal));

    public static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "PoliValko.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new DirectoryNotFoundException("PoliValko.slnx");
    }

    public static string HostPath(string key) =>
        Path.GetFullPath(typeof(SolutionAssemblies).Assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .Single(attribute => attribute.Key == key)
            .Value!);
}
