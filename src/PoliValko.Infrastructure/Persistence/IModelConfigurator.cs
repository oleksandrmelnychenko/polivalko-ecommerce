using Microsoft.EntityFrameworkCore;

namespace PoliValko.Infrastructure.Persistence;

/// <summary>Модуль реєструє свої сутності в спільній моделі EF Core.</summary>
public interface IModelConfigurator
{
    void Configure(ModelBuilder modelBuilder);
}
