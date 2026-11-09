using PoliValko.Api.Composition;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddPoliValkoApi(builder.Configuration, builder.Environment);
var app = builder.Build();
app.UsePoliValkoPipeline();
app.MapPoliValkoEndpoints();
await app.PrepareDatabaseAsync();
await app.RunAsync();

public partial class Program;
