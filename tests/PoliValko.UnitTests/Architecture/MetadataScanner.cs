using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;

namespace PoliValko.UnitTests.Architecture;

internal static class MetadataScanner
{
    public sealed record TypeRef(string Assembly, string Namespace, string Name);

    public sealed record TypeDef(string Namespace, string Name);

    public static IReadOnlyList<TypeRef> TypeReferences(string path) =>
        Read(path, reader =>
        {
            var own = reader.GetString(reader.GetAssemblyDefinition().Name);
            var result = new List<TypeRef>();
            foreach (var handle in reader.TypeReferences)
            {
                var outer = reader.GetTypeReference(handle);
                while (outer.ResolutionScope.Kind == HandleKind.TypeReference)
                {
                    outer = reader.GetTypeReference((TypeReferenceHandle)outer.ResolutionScope);
                }

                var assembly = outer.ResolutionScope.Kind == HandleKind.AssemblyReference
                    ? reader.GetString(reader.GetAssemblyReference((AssemblyReferenceHandle)outer.ResolutionScope).Name)
                    : own;
                result.Add(new TypeRef(assembly, reader.GetString(outer.Namespace), reader.GetString(outer.Name)));
            }

            return result;
        });

    public static IReadOnlyList<string> AssemblyReferences(string path) =>
        Read(path, reader => reader.AssemblyReferences
            .Select(handle => reader.GetString(reader.GetAssemblyReference(handle).Name))
            .ToList());

    public static IReadOnlyList<TypeDef> TopLevelTypes(string path) =>
        Read(path, reader => reader.TypeDefinitions
            .Select(reader.GetTypeDefinition)
            .Where(definition => definition.GetDeclaringType().IsNil)
            .Select(definition => new TypeDef(reader.GetString(definition.Namespace), reader.GetString(definition.Name)))
            .ToList());

    private static T Read<T>(string path, Func<MetadataReader, T> read)
    {
        using var stream = File.OpenRead(path);
        using var pe = new PEReader(stream);
        return read(pe.GetMetadataReader());
    }
}
