using System.Reflection;
using System.Runtime.CompilerServices;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.UnitTests.Architecture;

public sealed class ModuleLayoutTests
{
    private static readonly string[] AllowedAreas = ["Contracts", "Configuration", "Domain", "Persistence", "Features", "Integrations", "Jobs"];

    [Fact]
    public void Module_root_namespace_contains_only_the_entry_point()
    {
        var violations = new List<string>();
        foreach (var module in SolutionAssemblies.Modules)
        {
            var name = SolutionAssemblies.Name(module);
            var entryPoint = EntryPointName(module);
            var root = SourceTypes(module).Where(type => type.Namespace == name).ToList();

            violations.AddRange(root
                .Where(type => type.Name != entryPoint)
                .Select(type => $"{type.FullName} is in the module root namespace"));

            var entry = root.SingleOrDefault(type => type.Name == entryPoint);
            if (entry is null)
            {
                violations.Add($"{name}.{entryPoint} is missing");
            }
            else if (!(entry.IsClass && entry.IsPublic && entry.IsAbstract && entry.IsSealed))
            {
                violations.Add($"{entry.FullName} is not a public static class");
            }
        }

        violations.ShouldBeEmpty();
    }

    [Fact]
    public void Module_types_live_in_allowed_namespaces()
    {
        var violations = new List<string>();
        foreach (var module in SolutionAssemblies.Modules)
        {
            var name = SolutionAssemblies.Name(module);
            violations.AddRange(SourceTypes(module)
                .Where(type => type.Namespace != name && !IsInAllowedArea(type.Namespace!, name))
                .Select(type => type.FullName!));
        }

        violations.ShouldBeEmpty();
    }

    [Fact]
    public void Module_entry_point_has_the_common_registration_method()
    {
        var violations = new List<string>();
        foreach (var module in SolutionAssemblies.Modules)
        {
            var name = SolutionAssemblies.Name(module);
            var entry = module.GetType($"{name}.{EntryPointName(module)}");
            var method = entry?.GetMethod(
                $"Add{SolutionAssemblies.ShortName(name)}Module",
                BindingFlags.Public | BindingFlags.Static,
                [typeof(IServiceCollection), typeof(IConfiguration)]);
            if (method is null || method.ReturnType != typeof(IServiceCollection))
            {
                violations.Add($"{name}: Add{SolutionAssemblies.ShortName(name)}Module(IServiceCollection, IConfiguration) is missing");
            }
        }

        violations.ShouldBeEmpty();
    }

    [Fact]
    public void Scheduled_jobs_live_in_jobs_namespaces()
    {
        var jobs = SolutionAssemblies.Modules
            .SelectMany(module => SourceTypes(module)
                .Where(type => type.IsSubclassOf(typeof(ScheduledJobService)))
                .Select(type => (Type: type, Module: SolutionAssemblies.Name(module))))
            .ToList();

        jobs.ShouldNotBeEmpty();
        jobs.Where(job => !IsInArea(job.Type.Namespace!, job.Module, "Jobs"))
            .Select(job => job.Type.FullName)
            .ShouldBeEmpty();
    }

    [Fact]
    public void Outbox_messages_live_in_contracts_namespaces()
    {
        var messages = SolutionAssemblies.Modules
            .SelectMany(module => SourceTypes(module)
                .Where(type => type is { IsAbstract: false, IsInterface: false } && typeof(IOutboxMessage).IsAssignableFrom(type))
                .Select(type => (Type: type, Module: SolutionAssemblies.Name(module))))
            .ToList();

        messages.ShouldNotBeEmpty();
        messages.Where(message => !IsInArea(message.Type.Namespace!, message.Module, "Contracts"))
            .Select(message => message.Type.FullName)
            .ShouldBeEmpty();

        SourceTypes(SolutionAssemblies.Infrastructure)
            .Where(type => type is { IsAbstract: false, IsInterface: false } && typeof(IOutboxMessage).IsAssignableFrom(type))
            .ShouldBe([typeof(IntegrationAlert)]);
    }

    private static string EntryPointName(Assembly module) => $"{SolutionAssemblies.ShortName(SolutionAssemblies.Name(module))}Module";

    private static bool IsInAllowedArea(string ns, string module) => AllowedAreas.Any(area => IsInArea(ns, module, area));

    private static bool IsInArea(string ns, string module, string area) =>
        ns == $"{module}.{area}" || ns.StartsWith($"{module}.{area}.", StringComparison.Ordinal);

    private static List<Type> SourceTypes(Assembly assembly) =>
        assembly.GetTypes()
            .Where(type => !type.IsNested
                && !type.Name.StartsWith('<')
                && !type.IsDefined(typeof(CompilerGeneratedAttribute), inherit: false)
                && type.Namespace != "System.Text.RegularExpressions.Generated"
                && type.Namespace?.StartsWith("PoliValko", StringComparison.Ordinal) == true)
            .ToList();
}
