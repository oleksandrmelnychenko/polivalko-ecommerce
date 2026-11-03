namespace PoliValko.UnitTests.Architecture;

public sealed class HostCompositionTests
{
    [Theory]
    [InlineData("PoliValko.Api.Path")]
    [InlineData("PoliValko.Worker.Path")]
    public void Host_reaches_modules_only_through_entry_points_and_contracts(string host)
    {
        var violations = MetadataScanner.TypeReferences(ExistingHost(host))
            .Where(reference => SolutionAssemblies.ModuleNames.Contains(reference.Assembly)
                && !IsModuleEntryPoint(reference)
                && !SolutionAssemblies.IsContractsNamespace(reference.Namespace, reference.Assembly))
            .Select(reference => $"{reference.Namespace}.{reference.Name}")
            .Distinct()
            .ToList();

        violations.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("PoliValko.Api.Path")]
    [InlineData("PoliValko.Worker.Path")]
    public void Host_does_not_query_the_database(string host)
    {
        var queries = MetadataScanner.TypeReferences(ExistingHost(host))
            .Where(reference => (reference.Namespace, reference.Name) is ("System.Linq", "Queryable")
                or ("Microsoft.EntityFrameworkCore", "EntityFrameworkQueryableExtensions"))
            .ToList();

        queries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("PoliValko.Api.Path", "PoliValko.Api.Composition")]
    [InlineData("PoliValko.Worker.Path", "PoliValko.Worker.Composition")]
    public void Host_declares_types_only_in_composition(string host, string composition)
    {
        var types = MetadataScanner.TopLevelTypes(ExistingHost(host))
            .Where(type => type.Namespace.StartsWith("PoliValko", StringComparison.Ordinal))
            .ToList();

        types.ShouldNotBeEmpty();
        types.Where(type => type.Namespace != composition)
            .Select(type => $"{type.Namespace}.{type.Name}")
            .ShouldBeEmpty();
    }

    private static string ExistingHost(string host)
    {
        var path = SolutionAssemblies.HostPath(host);
        File.Exists(path).ShouldBeTrue(path);
        return path;
    }

    private static bool IsModuleEntryPoint(MetadataScanner.TypeRef reference) =>
        reference.Namespace == reference.Assembly
        && reference.Name == $"{SolutionAssemblies.ShortName(reference.Assembly)}Module";
}
