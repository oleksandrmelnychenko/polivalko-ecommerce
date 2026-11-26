type StandIn = { url: string; alt: string; credit: string; page: string };

const CREDIT = "Фото: Poli Valko";
const photo = (path: string, alt: string): StandIn => ({
  url: path,
  alt,
  credit: CREDIT,
  page: "/",
});

export const categoryPhotos: Record<string, StandIn> = {
  "vse-dlia-vidpochynku": photo("/brand/about-garden.webp", "Тераса та зона відпочинку в саду"),
  "vse-dlia-polyvu": photo("/brand/service-irrigation.webp", "Система автоматичного поливу газону"),
  "vse-dlia-roslyn": photo("/brand/service-planting.webp", "Висаджування та догляд за садовими рослинами"),
  "hospodarchi-tovary": photo("/brand/delivery-parcel.webp", "Господарські товари для дому та саду Poli Valko"),
  "landshaftnyi-dyzain": photo("/brand/garden-plan.webp", "Ландшафтний дизайн та планування садової ділянки"),
  "novyi-rik": photo("/brand/polivalko-bucha.jpg", "Новорічний декор і товари в магазині Poli Valko"),
  "ruchnyi-instrument": photo("/brand/garden-services.webp", "Садовий ручний інструмент для догляду за ділянкою"),
  "tekhnika-dlia-sadu-ta-horodu": photo("/brand/about-garden.webp", "Техніка для догляду за садом, газоном і городом"),
};

export const pagePhotos = {
  hero: photo("/brand/about-garden.webp", "Доглянутий сад і тераса — товари для саду й городу Poli Valko"),
  heroSale: photo("/brand/service-planting.webp", "Акційні товари для саду, поливу й догляду за рослинами"),
  offers: photo("/brand/service-irrigation.webp", "Знижки на товари для поливу й саду"),
  collection: photo("/brand/about-garden.webp", "Добірка популярних товарів для саду й відпочинку"),
  sections: photo("/brand/garden-plan.webp", "Розділи каталогу садового центру Poli Valko"),
  services: photo("/brand/garden-services.webp", "Послуги з ландшафтного дизайну, озеленення та автополиву"),
  journey: photo("/brand/service-irrigation.webp", "Монтаж і обслуговування систем поливу"),
  store: photo("/brand/polivalko-bucha.jpg", "Магазин Poli Valko у Бучі, ТК «Варшавський»"),
} satisfies Record<string, StandIn>;
