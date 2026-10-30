namespace PoliValko.Delivery;

public sealed record Settlement(string Ref, string Name, string Area);

public enum WarehouseType
{
    Branch,
    Postomat,
}

public sealed record Warehouse(string Ref, string SettlementRef, int Number, string Name, string Address, WarehouseType Type);

public sealed record PickupPoint(string Code, string Name, string Address, string Schedule, string Instructions, string? MapUrl = null);

/// <summary>
/// Довідник населених пунктів і відділень та точка самовивозу. З ключем API Нової пошти 2.0
/// (<c>Delivery:NovaPoshta:ApiKey</c>) — локальна копія довідника в БД, яку щоночі оновлює Worker;
/// без ключа — демо-дані в пам'яті. Точки самовивозу завжди з БД (їх веде адміністратор).
/// Реєструється як scoped: залежить від контексту БД, тож отримувати його треба в межах запиту.
/// </summary>
public interface IDeliveryDirectory
{
    ValueTask<IReadOnlyList<Settlement>> SearchSettlementsAsync(string? query, int limit, CancellationToken ct);

    ValueTask<Settlement?> FindSettlementAsync(string reference, CancellationToken ct);

    /// <summary>null — населеного пункту немає в довіднику.</summary>
    ValueTask<IReadOnlyList<Warehouse>?> GetWarehousesAsync(string settlementRef, string? query, CancellationToken ct);

    ValueTask<Warehouse?> FindWarehouseAsync(string reference, CancellationToken ct);

    /// <summary>Магазин для самовивозу: адреса, графік та інструкція покупцю.</summary>
    ValueTask<PickupPoint> GetPickupAsync(CancellationToken ct);
}

/// <summary>
/// Демо-довідник Нової пошти для прототипу: кілька міст і відділень із вигаданими адресами.
/// Не використовувати в production — потрібен ключ API Нової пошти 2.0 (розділ 6 ТЗ).
/// Точка самовивозу — справжня, з БД.
/// </summary>
internal sealed class DemoNovaPoshtaDirectory(PickupPointStore pickup) : IDeliveryDirectory
{
    private static readonly Settlement[] Settlements =
    [
        new("demo-kyiv", "Київ", "Київська обл."),
        new("demo-bucha", "Буча", "Київська обл."),
        new("demo-irpin", "Ірпінь", "Київська обл."),
        new("demo-hostomel", "Гостомель", "Київська обл."),
        new("demo-vorzel", "Ворзель", "Київська обл."),
        new("demo-boryspil", "Бориспіль", "Київська обл."),
        new("demo-lviv", "Львів", "Львівська обл."),
        new("demo-odesa", "Одеса", "Одеська обл."),
        new("demo-dnipro", "Дніпро", "Дніпропетровська обл."),
        new("demo-kharkiv", "Харків", "Харківська обл."),
    ];

    private static readonly Warehouse[] Warehouses =
    [
        Branch("demo-kyiv", 1, "вул. Пирогівський шлях, 135"),
        Branch("demo-kyiv", 12, "вул. Велика Васильківська, 72"),
        Branch("demo-kyiv", 48, "просп. Перемоги, 67"),
        Postomat("demo-kyiv", 30215, "вул. Хрещатик, 22, у супермаркеті"),
        Postomat("demo-kyiv", 30477, "вул. Січових Стрільців, 37"),
        Branch("demo-bucha", 1, "вул. Енергетиків, 4"),
        Branch("demo-bucha", 2, "вул. Вокзальна, 61"),
        Branch("demo-bucha", 5, "бульв. Б. Хмельницького, 6"),
        Postomat("demo-bucha", 31008, "вул. Нове Шосе, 8"),
        Branch("demo-irpin", 1, "вул. Соборна, 105"),
        Branch("demo-irpin", 3, "вул. Університетська, 2"),
        Postomat("demo-irpin", 31120, "вул. Григорія Сковороди, 13"),
        Branch("demo-hostomel", 1, "вул. Свято-Покровська, 64"),
        Postomat("demo-hostomel", 31244, "вул. Леніна, 2, у магазині"),
        Branch("demo-hostomel", 2, "вул. Остромирська, 50"),
        Branch("demo-vorzel", 1, "вул. Курортна, 17"),
        Branch("demo-vorzel", 2, "вул. Кленова, 3"),
        Postomat("demo-vorzel", 31390, "вул. Яблунська, 9"),
        Branch("demo-boryspil", 1, "вул. Київський шлях, 75"),
        Branch("demo-boryspil", 4, "вул. Головатого, 30"),
        Postomat("demo-boryspil", 31455, "вул. Глибоцька, 2"),
        Branch("demo-lviv", 1, "вул. Городоцька, 359"),
        Branch("demo-lviv", 15, "вул. Наукова, 7"),
        Branch("demo-lviv", 33, "просп. Червоної Калини, 62"),
        Postomat("demo-lviv", 32011, "вул. Шевченка, 60"),
        Branch("demo-odesa", 1, "вул. Базова, 16"),
        Branch("demo-odesa", 20, "вул. Канатна, 81"),
        Postomat("demo-odesa", 33102, "вул. Дерибасівська, 10"),
        Branch("demo-dnipro", 1, "вул. Маршала Малиновського, 114"),
        Branch("demo-dnipro", 9, "просп. Яворницького, 50"),
        Postomat("demo-dnipro", 34050, "вул. Робоча, 23"),
        Branch("demo-kharkiv", 1, "вул. Полтавський шлях, 182"),
        Branch("demo-kharkiv", 22, "просп. Науки, 44"),
        Postomat("demo-kharkiv", 35071, "вул. Сумська, 2"),
    ];

    public ValueTask<PickupPoint> GetPickupAsync(CancellationToken ct) => pickup.GetDefaultAsync(ct);

    public ValueTask<IReadOnlyList<Settlement>> SearchSettlementsAsync(string? query, int limit, CancellationToken ct)
    {
        var term = query?.Trim();
        IReadOnlyList<Settlement> result = string.IsNullOrEmpty(term) || term.Length < 2
            ? Settlements.Take(Math.Min(limit, 8)).ToList()
            : Settlements.Where(s => s.Name.Contains(term, StringComparison.CurrentCultureIgnoreCase)).Take(limit).ToList();
        return ValueTask.FromResult(result);
    }

    public ValueTask<Settlement?> FindSettlementAsync(string reference, CancellationToken ct) =>
        ValueTask.FromResult(Settlements.FirstOrDefault(s => s.Ref == reference));

    public ValueTask<IReadOnlyList<Warehouse>?> GetWarehousesAsync(string settlementRef, string? query, CancellationToken ct)
    {
        if (Settlements.All(s => s.Ref != settlementRef))
        {
            return ValueTask.FromResult<IReadOnlyList<Warehouse>?>(null);
        }

        var term = query?.Trim();
        var list = Warehouses
            .Where(w => w.SettlementRef == settlementRef)
            .Where(w => string.IsNullOrEmpty(term)
                        || w.Name.Contains(term, StringComparison.CurrentCultureIgnoreCase)
                        || w.Address.Contains(term, StringComparison.CurrentCultureIgnoreCase))
            .OrderBy(w => w.Type)
            .ThenBy(w => w.Number)
            .ToList();
        return ValueTask.FromResult<IReadOnlyList<Warehouse>?>(list);
    }

    public ValueTask<Warehouse?> FindWarehouseAsync(string reference, CancellationToken ct) =>
        ValueTask.FromResult(Warehouses.FirstOrDefault(w => w.Ref == reference));

    private static Warehouse Branch(string settlementRef, int number, string address) =>
        new($"{settlementRef}-b{number}", settlementRef, number, $"Відділення №{number}", address, WarehouseType.Branch);

    private static Warehouse Postomat(string settlementRef, int number, string address) =>
        new($"{settlementRef}-p{number}", settlementRef, number, $"Поштомат №{number}", address, WarehouseType.Postomat);
}
