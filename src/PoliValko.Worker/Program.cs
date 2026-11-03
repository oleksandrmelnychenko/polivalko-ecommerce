using PoliValko.Worker.Composition;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddPoliValkoWorker(builder.Configuration);
await builder.Build().RunAsync();
