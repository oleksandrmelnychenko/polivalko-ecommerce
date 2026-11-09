using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security.DataProtection;

namespace PoliValko.IntegrationTests;

public sealed class KeyProtectionTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Legacy_keys_are_encrypted_without_losing_payloads_and_rotation_survives_restart()
    {
        var initialIds = await api.WithDbAsync(db => db.DataProtectionKeys.Select(k => k.Id).ToArrayAsync(Ct));
        using var certificates = new TestKeyCertificate();
        foreach (var extension in new[] { ".crt", ".key" })
            File.Copy(Path.Combine(api.CertificateDirectory, "current" + extension), Path.Combine(certificates.DirectoryPath, "current" + extension), overwrite: true);
        try
        {
            using var legacy = Build(null, protect: false);
            var key = legacy.Services.GetRequiredService<IKeyManager>().CreateNewKey(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddDays(30));
            var token = legacy.Services.GetDataProtector("regression-payload").Protect("original payload");
            var before = await api.WithDbAsync(db => db.DataProtectionKeys.Where(k => !initialIds.Contains(k.Id)).Select(k => k.Xml).ToArrayAsync(Ct));
            before.ShouldContain(xml => xml!.Contains("<masterKey"));

            using (var encrypted = Build(certificates.DirectoryPath))
            {
                await StartKeyService(encrypted);
                encrypted.Services.GetDataProtector("regression-payload").Unprotect(token).ShouldBe("original payload");
                encrypted.Services.GetRequiredService<IKeyManager>().GetAllKeys().ShouldContain(k => k.KeyId == key.KeyId);
                await StartKeyService(encrypted); // Repeatable migration.
            }
            var after = await api.WithDbAsync(db => db.DataProtectionKeys.Select(k => k.Xml).ToArrayAsync(Ct));
            after.ShouldAllBe(xml => xml!.Contains("encryptedSecret") && !xml.Contains("<masterKey"));

            foreach (var extension in new[] { ".crt", ".key" })
                File.Move(Path.Combine(certificates.DirectoryPath, "current" + extension), Path.Combine(certificates.DirectoryPath, "previous" + extension));
            certificates.WriteCertificate("current");
            string rotatedToken;
            using (var rotated = Build(certificates.DirectoryPath))
            {
                await StartKeyService(rotated);
                rotated.Services.GetDataProtector("regression-payload").Unprotect(token).ShouldBe("original payload");
                rotated.Services.GetRequiredService<IKeyManager>().CreateNewKey(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(90));
                rotatedToken = rotated.Services.GetDataProtector("regression-payload").Protect("rotated payload");
            }
            using (var restarted = Build(certificates.DirectoryPath))
            {
                await StartKeyService(restarted);
                restarted.Services.GetDataProtector("regression-payload").Unprotect(token).ShouldBe("original payload");
                restarted.Services.GetDataProtector("regression-payload").Unprotect(rotatedToken).ShouldBe("rotated payload");
            }
            using var wrongCertificates = new TestKeyCertificate();
            using var wrong = Build(wrongCertificates.DirectoryPath);
            await Should.ThrowAsync<CryptographicException>(() => StartKeyService(wrong));
        }
        finally
        {
            await api.WithDbAsync(db => db.DataProtectionKeys.Where(k => !initialIds.Contains(k.Id)).ExecuteDeleteAsync(Ct));
        }
    }

    [Fact]
    public void Production_cannot_start_without_wrapping_certificate()
    {
        Should.Throw<InvalidOperationException>(() => Build(null));
    }

    private IHost Build(string? directory, bool protect = true)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = Environments.Production });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:PoliValko"] = api.Services.GetRequiredService<IConfiguration>().GetConnectionString("PoliValko"),
            ["DataProtection:CertificateDirectory"] = directory,
        });
        builder.Services.AddPlatform();
        if (protect) builder.Services.AddProtectedKeyRing(builder.Configuration, builder.Environment);
        else builder.Services.AddDataProtection().SetApplicationName("PoliValko").PersistKeysToDbContext<PoliValkoDbContext>();
        return builder.Build();
    }

    private static Task StartKeyService(IHost host) => host.Services.GetServices<IHostedService>()
        .Single(s => s.GetType().Name == "KeyRingEncryptionService").StartAsync(Ct);
}
