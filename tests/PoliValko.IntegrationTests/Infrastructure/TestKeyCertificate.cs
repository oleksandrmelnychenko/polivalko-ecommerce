using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace PoliValko.IntegrationTests;

internal sealed class TestKeyCertificate : IDisposable
{
    public string DirectoryPath { get; } = Path.Combine(Path.GetTempPath(), $"polivalko-key-tests-{Guid.NewGuid():N}");

    public TestKeyCertificate()
    {
        Directory.CreateDirectory(DirectoryPath);
        WriteCertificate("current");
    }

    public void WriteCertificate(string name)
    {
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("CN=PoliValko test only", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(30));
        File.WriteAllText(Path.Combine(DirectoryPath, name + ".crt"), certificate.ExportCertificatePem());
        File.WriteAllText(Path.Combine(DirectoryPath, name + ".key"), rsa.ExportPkcs8PrivateKeyPem());
    }

    public void Dispose() => Directory.Delete(DirectoryPath, recursive: true);
}
