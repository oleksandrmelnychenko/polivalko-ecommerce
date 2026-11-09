using System.Reflection;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.XmlEncryption;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Security.DataProtection;

public static class KeyProtection
{
    public static IServiceCollection AddProtectedKeyRing(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        // These tooling hosts cannot serve requests and must not require runtime secrets or a database.
        if (Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider" || EF.IsDesignTime)
        {
            services.AddDataProtection().SetApplicationName("PoliValko").UseEphemeralDataProtectionProvider();
            return services;
        }
        var directory = configuration["DataProtection:CertificateDirectory"];
        if (string.IsNullOrWhiteSpace(directory) && environment.IsDevelopment())
            directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".local", "share", "polivalko", "data-protection");
        if (string.IsNullOrWhiteSpace(directory))
            throw new InvalidOperationException("DataProtection:CertificateDirectory is required.");
        var certificates = new KeyCertificates(directory);
        services.AddSingleton(_ => certificates);
        services.AddDataProtection().SetApplicationName("PoliValko").PersistKeysToDbContext<PoliValkoDbContext>()
            .ProtectKeysWithCertificate(certificates.Current).UnprotectKeysWithAnyCertificate(certificates.All.ToArray());
        services.AddHostedService<KeyRingEncryptionService>();
        return services;
    }
}

internal sealed class KeyCertificates : IDisposable
{
    public X509Certificate2 Current { get; }
    public IReadOnlyList<X509Certificate2> All { get; }

    public KeyCertificates(string directory)
    {
        if (!Directory.Exists(directory))
            throw new InvalidOperationException("Set DataProtection:CertificateDirectory to a private directory containing current.crt and current.key. Use deploy/create-key-certificate.sh to prepare it.");

        var loaded = new List<X509Certificate2>();
        try
        {
            Current = Load(Path.Combine(directory, "current.crt"));
            loaded.Add(Current);
            foreach (var path in Directory.EnumerateFiles(directory, "*.crt").Order(StringComparer.Ordinal))
            {
                if (Path.GetFileName(path) != "current.crt") loaded.Add(Load(path));
            }
            All = loaded;
        }
        catch
        {
            foreach (var certificate in loaded) certificate.Dispose();
            throw;
        }
    }

    private static X509Certificate2 Load(string path)
    {
        var certificate = X509Certificate2.CreateFromPemFile(path, Path.ChangeExtension(path, ".key"));
        using var rsa = certificate.GetRSAPrivateKey();
        if (rsa is null || rsa.KeySize < 2048)
        {
            certificate.Dispose();
            throw new InvalidOperationException("Data Protection requires an RSA certificate with a private key of at least 2048 bits.");
        }
        return certificate;
    }

    public void Dispose()
    {
        foreach (var certificate in All) certificate.Dispose();
    }
}

// Runs before HTTP serving, even when normal database seeding is disabled.
internal sealed class KeyRingEncryptionService(
    IServiceScopeFactory scopes,
    KeyCertificates certificates,
    ILoggerFactory loggerFactory,
    IServiceProvider services,
    ILogger<KeyRingEncryptionService> logger) : IHostedService
{
    private static readonly XNamespace ProtectionXml = "http://schemas.asp.net/2015/03/dataProtection";

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var encryptor = new CertificateXmlEncryptor(certificates.Current, loggerFactory);
        // Validate every retained key with the configured certificates before accepting traffic.
        foreach (var key in services.GetRequiredService<IKeyManager>().GetAllKeys())
            _ = key.CreateEncryptor() ?? throw new CryptographicException("A retained Data Protection key cannot be decrypted.");

        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<PoliValkoDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        // Serializes legacy rewrites across API replicas; the key IDs and secret bytes stay unchanged.
        var rows = await db.DataProtectionKeys.FromSqlRaw("SELECT * FROM identity.data_protection_keys FOR UPDATE")
            .ToListAsync(cancellationToken);
        var changed = 0;
        foreach (var row in rows)
        {
            var xml = XElement.Parse(row.Xml ?? throw new InvalidOperationException("Empty Data Protection key."));
            var secrets = xml.Descendants().Where(e => (bool?)e.Attribute(ProtectionXml + "requiresEncryption") == true).ToArray();
            if (secrets.Length == 0) continue;
            foreach (var secret in secrets)
            {
                if (secret.Parent is null) continue;
                var encrypted = encryptor.Encrypt(new XElement(secret));
                secret.ReplaceWith(new XElement(ProtectionXml + "encryptedSecret",
                    new XAttribute("decryptorType", encrypted.DecryptorType.AssemblyQualifiedName!), encrypted.EncryptedElement));
            }
            row.Xml = xml.ToString(SaveOptions.DisableFormatting);
            changed++;
        }
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        logger.LogInformation("Data Protection key ring ready; encrypted {Count} legacy records", changed);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
