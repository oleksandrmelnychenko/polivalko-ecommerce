using System.Reflection;
using System.Runtime.CompilerServices;

namespace PoliValko.UnitTests.Architecture;

public sealed class ModuleBoundaryTests
{
    private const BindingFlags Members = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;

    private static readonly string[] Hosts = ["PoliValko.Api", "PoliValko.Worker"];

    private static readonly string[] TestAssemblies = ["PoliValko.IntegrationTests", "PoliValko.UnitTests"];

    [Fact]
    public void Module_list_matches_module_folders()
    {
        var folders = Directory.GetDirectories(Path.Combine(SolutionAssemblies.RepositoryRoot(), "src", "Modules"))
            .Select(directory => new DirectoryInfo(directory).Name)
            .Order(StringComparer.Ordinal);

        SolutionAssemblies.ModuleNames.Order(StringComparer.Ordinal).ShouldBe(folders);
    }

    [Fact]
    public void Modules_reference_other_modules_only_through_contracts()
    {
        var violations = new List<string>();
        foreach (var module in SolutionAssemblies.Modules)
        {
            var name = SolutionAssemblies.Name(module);
            violations.AddRange(MetadataScanner.TypeReferences(module.Location)
                .Where(reference => reference.Assembly != name
                    && SolutionAssemblies.ModuleNames.Contains(reference.Assembly)
                    && !SolutionAssemblies.IsContractsNamespace(reference.Namespace, reference.Assembly))
                .Select(reference => $"{name} -> {reference.Namespace}.{reference.Name}")
                .Distinct());
        }

        violations.ShouldBeEmpty();
    }

    [Fact]
    public void Modules_do_not_reference_hosts()
    {
        var violations = SolutionAssemblies.Modules
            .SelectMany(module => MetadataScanner.AssemblyReferences(module.Location)
                .Where(reference => Hosts.Contains(reference))
                .Select(host => $"{SolutionAssemblies.Name(module)} -> {host}"))
            .ToList();

        violations.ShouldBeEmpty();
    }

    [Fact]
    public void Platform_does_not_reference_modules()
    {
        MetadataScanner.AssemblyReferences(SolutionAssemblies.Infrastructure.Location)
            .Where(reference => SolutionAssemblies.ModuleNames.Contains(reference) || Hosts.Contains(reference))
            .ShouldBeEmpty();

        MetadataScanner.AssemblyReferences(SolutionAssemblies.SharedKernel.Location)
            .Where(reference => reference.StartsWith(SolutionAssemblies.Prefix, StringComparison.Ordinal))
            .ShouldBeEmpty();
    }

    [Fact]
    public void Contracts_expose_only_platform_and_contract_types()
    {
        var violations = new List<string>();
        foreach (var module in SolutionAssemblies.Modules)
        {
            var name = SolutionAssemblies.Name(module);
            foreach (var type in module.GetExportedTypes().Where(t => SolutionAssemblies.IsContractsNamespace(t.Namespace, name)))
            {
                violations.AddRange(Signature(type)
                    .SelectMany(Unwrap)
                    .Where(exposed => exposed.Namespace?.StartsWith("PoliValko", StringComparison.Ordinal) == true && !IsAllowedInContracts(exposed))
                    .Select(exposed => $"{type.FullName} -> {exposed.FullName}")
                    .Distinct());
            }
        }

        violations.ShouldBeEmpty();
    }

    [Fact]
    public void Internals_are_visible_only_to_test_assemblies()
    {
        var violations = SolutionAssemblies.Source
            .SelectMany(assembly => assembly.GetCustomAttributes<InternalsVisibleToAttribute>()
                .Where(attribute => !TestAssemblies.Contains(attribute.AssemblyName))
                .Select(attribute => $"{SolutionAssemblies.Name(assembly)} -> {attribute.AssemblyName}"))
            .ToList();

        violations.ShouldBeEmpty();
    }

    private static IEnumerable<Type> Signature(Type type)
    {
        if (type.BaseType is { } baseType)
        {
            yield return baseType;
        }

        foreach (var contract in type.GetInterfaces())
        {
            yield return contract;
        }

        foreach (var constructor in type.GetConstructors(Members))
        {
            foreach (var parameter in constructor.GetParameters())
            {
                yield return parameter.ParameterType;
            }
        }

        foreach (var method in type.GetMethods(Members))
        {
            yield return method.ReturnType;
            foreach (var parameter in method.GetParameters())
            {
                yield return parameter.ParameterType;
            }
        }

        foreach (var property in type.GetProperties(Members))
        {
            yield return property.PropertyType;
        }

        foreach (var field in type.GetFields(Members))
        {
            yield return field.FieldType;
        }
    }

    private static IEnumerable<Type> Unwrap(Type type)
    {
        if (type.IsGenericParameter)
        {
            yield break;
        }

        if (type.HasElementType)
        {
            foreach (var element in Unwrap(type.GetElementType()!))
            {
                yield return element;
            }

            yield break;
        }

        if (type.IsGenericType)
        {
            yield return type.GetGenericTypeDefinition();
            foreach (var argument in type.GetGenericArguments().SelectMany(Unwrap))
            {
                yield return argument;
            }

            yield break;
        }

        yield return type;
    }

    private static bool IsAllowedInContracts(Type type) =>
        type.Assembly == SolutionAssemblies.SharedKernel
        || type.Assembly == SolutionAssemblies.Infrastructure
        || type.Namespace!.Split('.') is ["PoliValko", _, "Contracts", ..];
}
