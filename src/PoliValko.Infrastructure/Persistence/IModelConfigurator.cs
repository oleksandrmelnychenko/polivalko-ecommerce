using Microsoft.EntityFrameworkCore;

namespace PoliValko.Infrastructure.Persistence;

public interface IModelConfigurator
{
    void Configure(ModelBuilder modelBuilder);
}
