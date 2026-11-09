using PoliValko.Worker.Composition;
using PoliValko.Infrastructure.Security.DataProtection;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddProtectedKeyRing(builder.Configuration, builder.Environment);
builder.Services.AddPoliValkoWorker(builder.Configuration);
await builder.Build().RunAsync();
