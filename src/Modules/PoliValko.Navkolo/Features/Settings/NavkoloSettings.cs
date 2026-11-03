using Microsoft.Extensions.Options;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.Navkolo.Features.Settings;

internal sealed class NavkoloSettings(IOptions<NavkoloOptions> options) : INavkoloSettings
{
    public string Mode => options.Value.Mode;
}
