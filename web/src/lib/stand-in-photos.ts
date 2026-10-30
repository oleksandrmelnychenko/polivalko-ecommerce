// Тимчасові фото розділів і сторінок з Unsplash (ліцензія Unsplash: вільне використання без обов'язкового авторства).
// Їх замінять фото магазину з адмінки.
export type StandIn = { url: string; alt: string; credit: string; page: string };

const CREDIT = "Фото: Unsplash, ліцензія Unsplash";
const photo = (id: string, alt: string): StandIn => ({
  url: `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=1200`,
  alt,
  credit: CREDIT,
  page: `https://images.unsplash.com/${id}`,
});

export const categoryPhotos: Record<string, StandIn> = {
  "vse-dlia-vidpochynku": photo("photo-1771276046005-9de355046e70", "Тераса з парасолями серед зелені"),
  "vse-dlia-polyvu": photo("photo-1780772415259-bda4359205a8", "Дощувач поливає газон на сонці"),
  "vse-dlia-roslyn": photo("photo-1621460248083-6271cc4437a8", "Висаджування розсади в підняту грядку"),
  "hospodarchi-tovary": photo("photo-1563210199-6ec2cfedd11e", "Дві садові тачки на газоні"),
  "landshaftnyi-dyzain": photo("photo-1764046860592-9931f0869fc6", "Доріжка серед квітучих клумб"),
  "novyi-rik": photo("photo-1602521879046-b994fcd56190", "Ялинкові кулі на гілках ялинки"),
  "ruchnyi-instrument": photo("photo-1573561368183-fd88bdb4503d", "Жовті садові інструменти на дерев'яній стіні"),
  "tekhnika-dlia-sadu-ta-horodu": photo("photo-1590820292118-e256c3ac2676", "Газонокосарка на газоні"),
};

export const pagePhotos = {
  hero: photo("photo-1719324923613-ff0884b031ed", "Сучасна тераса з садовими меблями й парасолею"),
  heroSale: photo("photo-1764046860592-9931f0869fc6", "Доріжка серед квітучих клумб у саду"),
  offers: photo("photo-1786459558726-2b672982ba55", "Оцинкована лійка на грядці серед зелені"),
  collection: photo("photo-1765097732474-973a92d6fb4c", "Білі металеві садові меблі серед рослин"),
  sections: photo("photo-1591857177580-dc82b9ac4e1e", "Підняті грядки із зеленню"),
  services: photo("photo-1596481768453-8befafc2d7ae", "Доглянутий сад із доріжкою й рослинами в горщиках"),
  journey: photo("photo-1786461157611-b04e0ca44f48", "Оцинкована лійка на грядці"),
  store: photo("photo-1752401966871-fcda5b645160", "Рослини на продаж у садовому центрі"),
} satisfies Record<string, StandIn>;
