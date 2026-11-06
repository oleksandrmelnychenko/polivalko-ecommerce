import { readFileSync } from "node:fs";
import { ConsoleClient, parseArgs } from "./console-client.mjs";

const args = parseArgs(process.argv.slice(2));

const COUNT = Number(args.count ?? 10000);
const CHUNK = Number(args.chunk ?? 2500);
const BASE = args.base ?? "http://127.0.0.1:8080";
const HOST = args.host ?? "console.localhost:8080";
const PREFIX = args.prefix ?? "syn";
const DRY = args["dry-run"] === "true";

function loadImages() {
  if (!args.images) return {};
  const pool = {};
  for (const line of readFileSync(args.images, "utf8").split(/\r?\n/)) {
    const [group, url] = line.split("|");
    if (group && url) (pool[group] ??= []).push(url.trim());
  }
  return pool;
}

let seed = Number(args.seed ?? 20261106);
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + random() * (max - min);
const roundPrice = (value) => (value < 100 ? Math.round(value) : value < 1000 ? Math.round(value / 5) * 5 - 1 : Math.round(value / 50) * 50 - 1);

const MODELS = ["Classic", "Comfort", "Premium", "Pro", "Basic", "Flex", "Eco", "Expert", "Garden", "Smart", "Ultra", "Optima"];
const GENERAL_BRANDS = ["Gardena", "Cellfast", "Bradas", "Verto", "Fiskars", "Intertool", "Grad", "Sigma", "Bergmann", "Garden Master"];

const CATALOG = {
  "Все для поливу": [
    { sub: "Шланги поливальні", types: ["Шланг поливальний", "Шланг армований", "Шланг розтяжний"], brands: ["Gardena", "Cellfast", "Bradas", "Presto-PS", "Verto", "Karcher"], attrs: { "Діаметр": ['1/2"', '3/4"', '1"'], "Довжина": ["10 м", "15 м", "20 м", "25 м", "30 м", "50 м"], "Матеріал": ["ПВХ", "Гума", "Силікон"] }, variantBy: "Довжина", price: [199, 3500] },
    { sub: "Розпилювачі й пістолети", types: ["Пістолет-розпилювач", "Насадка-розпилювач", "Душ садовий"], brands: ["Gardena", "Cellfast", "Bradas", "Karcher", "Verto"], attrs: { "Режимів поливу": ["1", "3", "5", "7", "8", "10"], "Матеріал": ["Пластик", "Метал"] }, price: [89, 1500] },
    { sub: "Дощувачі", types: ["Дощувач імпульсний", "Дощувач осцилюючий", "Дощувач круговий"], brands: ["Gardena", "Cellfast", "Bradas", "Karcher"], attrs: { "Площа поливу": ["до 100 м²", "до 200 м²", "до 300 м²", "до 500 м²"], "Матеріал": ["Пластик", "Метал"] }, price: [150, 2500] },
    { sub: "Крапельний полив", types: ["Комплект крапельного поливу", "Крапельниця регульована", "Трубка крапельна"], brands: ["Gardena", "Bradas", "Presto-PS", "Aquapulse"], attrs: { "Кількість": ["10 шт", "20 шт", "50 шт", "100 шт"], "Довжина": ["10 м", "25 м", "50 м", "100 м"] }, price: [49, 4500] },
    { sub: "Бочки й ємності", types: ["Бочка для води", "Бак садовий"], brands: ["Пласт Бокс", "Ал-Пластик", "Curver"], attrs: { "Об'єм": ["100 л", "200 л", "250 л", "500 л", "1000 л"], "Матеріал": ["Пластик", "Метал"] }, variantBy: "Об'єм", price: [499, 9000] },
  ],
  "Все для рослин": [
    { sub: "Ґрунти й субстрати", types: ["Ґрунт універсальний", "Субстрат для розсади", "Торф верховий"], brands: ["Florentin", "Royal Mix", "Peter Peat", "Agrolife"], attrs: { "Об'єм": ["5 л", "10 л", "20 л", "50 л", "70 л"] }, variantBy: "Об'єм", price: [39, 450] },
    { sub: "Добрива", types: ["Добриво комплексне", "Добриво для газону", "Добриво для хвойних", "Добриво для томатів"], brands: ["Agricola", "Yara", "Florovit", "Гумісол"], attrs: { "Вага": ["0,5 кг", "1 кг", "2 кг", "5 кг", "10 кг"], "Форма": ["Гранули", "Рідке", "Порошок"] }, price: [59, 1200] },
    { sub: "Насіння", types: ["Насіння газону", "Насіння томатів", "Насіння огірків", "Насіння квітів", "Насіння моркви"], brands: ["Насіння України", "Hem Zaden", "Clause", "Барвисте"], attrs: { "Вага": ["5 г", "20 г", "500 г", "1 кг"] }, price: [19, 900] },
    { sub: "Горщики й кашпо", types: ["Горщик керамічний", "Кашпо підвісне", "Ящик балконний", "Горщик пластиковий"], brands: ["Алеана", "Prosperplast", "Ceramika", "Lechuza"], attrs: { "Діаметр": ["12 см", "16 см", "20 см", "25 см", "30 см"], "Матеріал": ["Кераміка", "Пластик", "Бетон"], "Колір": ["Білий", "Сірий", "Теракота", "Чорний", "Зелений"] }, variantBy: "Діаметр", price: [49, 2500] },
    { sub: "Захист рослин", types: ["Фунгіцид", "Інсектицид", "Агроволокно", "Біопрепарат"], brands: ["Syngenta", "Bayer", "Агроволокно Plus", "Ензим"], attrs: { "Об'єм": ["10 мл", "50 мл", "100 мл", "1 л"], "Форма": ["Рідке", "Порошок"] }, price: [29, 900] },
  ],
  "Ручний інструмент": [
    { sub: "Лопати й вила", types: ["Лопата штикова", "Лопата совкова", "Вила садові", "Лопата снігова"], brands: ["Fiskars", "Gardena", "Truper", "Intertool", "Gruntek"], attrs: { "Матеріал": ["Сталь", "Нержавіюча сталь", "Алюміній"], "Довжина держака": ["110 см", "120 см", "130 см"] }, price: [249, 1900] },
    { sub: "Секатори й ножиці", types: ["Секатор площинний", "Секатор контактний", "Ножиці для живоплоту", "Сучкоріз"], brands: ["Fiskars", "Gardena", "Bahco", "Felco", "Gruntek"], attrs: { "Довжина": ["20 см", "50 см", "70 см"], "Матеріал": ["Сталь", "Нержавіюча сталь"] }, price: [199, 3500] },
    { sub: "Граблі й сапи", types: ["Граблі віялові", "Граблі прямі", "Сапа", "Культиватор ручний"], brands: ["Fiskars", "Gardena", "Truper", "Intertool"], attrs: { "Матеріал": ["Сталь", "Пластик"], "Ширина": ["30 см", "40 см", "50 см"] }, price: [149, 1200] },
    { sub: "Пили й сокири", types: ["Пила садова", "Сокира", "Колун", "Ножівка"], brands: ["Fiskars", "Bahco", "Gruntek", "Stanley"], attrs: { "Вага": ["0,6 кг", "1 кг", "1,5 кг", "2,5 кг"], "Довжина": ["30 см", "45 см", "70 см"] }, price: [299, 3900] },
  ],
  "Техніка для саду та городу": [
    { sub: "Газонокосарки", types: ["Газонокосарка бензинова", "Газонокосарка електрична", "Газонокосарка акумуляторна"], brands: ["Viking", "Toro", "Husqvarna", "Makita", "Bosch", "Stihl", "Al-ko"], attrs: { "Ширина скошування": ["32 см", "38 см", "42 см", "46 см", "51 см"], "Тип двигуна": ["Бензиновий", "Електричний", "Акумуляторний"], "Потужність": ["1,2 кВт", "1,6 кВт", "1,8 кВт", "2,7 к.с.", "3,5 к.с."] }, price: [4500, 45000] },
    { sub: "Тримери й мотокоси", types: ["Тример електричний", "Мотокоса", "Тример акумуляторний"], brands: ["Husqvarna", "Stihl", "Makita", "Bosch", "Echo"], attrs: { "Тип двигуна": ["Бензиновий", "Електричний", "Акумуляторний"], "Потужність": ["0,5 кВт", "1 кВт", "1,4 кВт", "2 к.с."] }, price: [1500, 18000] },
    { sub: "Мотоблоки й культиватори", types: ["Мотокультиватор", "Мотоблок"], brands: ["Forte", "Кентавр", "Honda", "Husqvarna"], attrs: { "Потужність": ["5 к.с.", "6,5 к.с.", "7 к.с.", "9 к.с."], "Ширина обробки": ["60 см", "85 см", "100 см"] }, price: [9000, 60000] },
    { sub: "Повітродуви й пилососи", types: ["Повітродув", "Садовий пилосос"], brands: ["Stihl", "Makita", "Bosch", "Husqvarna"], attrs: { "Тип двигуна": ["Бензиновий", "Електричний", "Акумуляторний"] }, price: [1200, 9000] },
    { sub: "Мийки високого тиску", types: ["Мийка високого тиску"], brands: ["Karcher", "Bosch", "Nilfisk", "Makita"], attrs: { "Тиск": ["110 бар", "130 бар", "150 бар"], "Потужність": ["1,5 кВт", "1,8 кВт", "2,1 кВт"] }, price: [2500, 25000] },
  ],
  "Все для відпочинку": [
    { sub: "Меблі садові", types: ["Крісло садове", "Стіл садовий", "Шезлонг", "Гойдалка садова", "Комплект садових меблів"], brands: ["Keter", "Allibert", "Jardin", "Curver"], attrs: { "Матеріал": ["Ротанг", "Дерево", "Метал", "Пластик"], "Колір": ["Білий", "Графіт", "Коричневий", "Бежевий"] }, price: [799, 25000] },
    { sub: "Гриль і барбекю", types: ["Гриль вугільний", "Гриль газовий", "Мангал", "Решітка для гриля"], brands: ["Weber", "Grill Chef", "Char-Broil", "Mangal Pro"], attrs: { "Матеріал": ["Сталь", "Чавун", "Нержавіюча сталь"] }, price: [299, 30000] },
    { sub: "Гамаки й намети", types: ["Гамак", "Намет туристичний", "Тент"], brands: ["Coleman", "Tramp", "Highlander"], attrs: { "Місткість": ["1 особа", "2 особи", "3 особи", "4 особи"] }, price: [399, 9000] },
    { sub: "Басейни", types: ["Басейн каркасний", "Басейн надувний", "Фільтр-насос"], brands: ["Intex", "Bestway"], attrs: { "Об'єм": ["1000 л", "3000 л", "5000 л", "10000 л"] }, variantBy: "Об'єм", price: [999, 35000] },
  ],
  "Господарчі товари": [
    { sub: "Прибирання", types: ["Віник", "Швабра", "Відро", "Совок"], brands: ["York", "Vileda", "Алеана", "Curver"], attrs: { "Матеріал": ["Пластик", "Метал", "Дерево"], "Об'єм": ["5 л", "10 л", "12 л", "15 л"] }, price: [49, 900] },
    { sub: "Зберігання", types: ["Контейнер для зберігання", "Ящик для інструментів", "Стелаж металевий"], brands: ["Keter", "Curver", "Stanley", "Qbrick"], attrs: { "Об'єм": ["10 л", "30 л", "60 л", "100 л"], "Матеріал": ["Пластик", "Метал"] }, price: [149, 4500] },
    { sub: "Господарські дрібниці", types: ["Рукавиці робочі", "Мішки для сміття", "Мотузка", "Скотч пакувальний"], brands: ["Intertool", "Paclan", "Sigma"], attrs: { "Кількість": ["1 шт", "10 шт", "20 шт", "50 шт"] }, price: [19, 399] },
  ],
  "Ландшафтний дизайн": [
    { sub: "Бордюри й огорожі", types: ["Бордюр садовий", "Огорожа декоративна", "Палісад"], brands: ["Prosperplast", "Bradas", "Альтернатива"], attrs: { "Довжина": ["5 м", "9 м", "10 м", "20 м"], "Колір": ["Зелений", "Коричневий", "Сірий"] }, variantBy: "Довжина", price: [149, 2500] },
    { sub: "Декор і фігури", types: ["Садова фігура", "Фонтан садовий", "Світильник садовий на сонячній батареї"], brands: ["Garden Art", "Lumi", "Solar Light"], attrs: { "Матеріал": ["Полістоун", "Метал", "Пластик"] }, price: [199, 12000] },
    { sub: "Мульча й каміння", types: ["Кора соснова", "Щебінь декоративний", "Агротканина"], brands: ["Agrolife", "Ландшафт Плюс", "Florentin"], attrs: { "Об'єм": ["20 л", "50 л", "70 л"], "Колір": ["Білий", "Сірий", "Коричневий"] }, price: [99, 1500] },
  ],
  "Новий рік": [
    { sub: "Ялинки", types: ["Ялинка штучна", "Сосна штучна", "Ялинка лита"], brands: ["Елітна ялинка", "Christmas Tree", "Ялинка UA"], attrs: { "Висота": ["120 см", "150 см", "180 см", "210 см"] }, variantBy: "Висота", price: [899, 9000] },
    { sub: "Гірлянди", types: ["Гірлянда світлодіодна", "Гірлянда-штора", "Гірлянда вулична"], brands: ["Feron", "Delux", "Lumion"], attrs: { "Довжина": ["5 м", "10 м", "20 м"], "Колір світіння": ["Теплий білий", "Холодний білий", "Мультиколор"] }, variantBy: "Довжина", price: [149, 2500] },
    { sub: "Прикраси", types: ["Набір ялинкових кульок", "Верхівка на ялинку", "Новорічний вінок"], brands: ["Christmas Decor", "Святкова мить", "Novogod"], attrs: { "Кількість": ["6 шт", "12 шт", "24 шт"], "Колір": ["Червоний", "Золотий", "Срібний", "Білий"] }, price: [99, 1500] },
  ],
};

const DESCRIPTIONS = [
  (n, b) => `${n} від ${b} для щоденної роботи в саду й на городі.`,
  (n, b) => `${n} ${b}: надійна конструкція і зручність у користуванні.`,
  (n) => `Підходить для приватного будинку, дачі й невеликих господарств.`,
  () => `Перед використанням ознайомтеся з інструкцією виробника.`,
  () => `Гарантія від виробника. Самовивіз у Бучі або доставка Новою поштою.`,
];

function buildRecords() {
  const images = loadImages();
  const subs = Object.entries(CATALOG).flatMap(([group, list]) => list.map((s) => ({ ...s, group })));
  const records = [];
  let n = 0;
  while (records.length < COUNT) {
    const spec = subs[n % subs.length];
    n += 1;
    const type = pick(spec.types);
    const brand = random() < 0.85 ? pick(spec.brands) : pick(GENERAL_BRANDS);
    const model = `${pick(MODELS)} ${Math.floor(between(100, 999))}`;
    const fixed = Object.fromEntries(Object.entries(spec.attrs).map(([name, values]) => [name, pick(values)]));
    const variantValues = spec.variantBy && random() < 0.6 ? spec.attrs[spec.variantBy].slice(0, 2 + Math.floor(random() * (spec.attrs[spec.variantBy].length - 1))) : [null];
    const base = between(spec.price[0], spec.price[1]);
    const variantGroup = variantValues.length > 1 ? `${PREFIX}-${records.length + 1}` : null;
    variantValues.forEach((variant, index) => {
      if (records.length >= COUNT) return;
      const number = String(records.length + 1).padStart(5, "0");
      const attrs = { ...fixed };
      if (variant) attrs[spec.variantBy] = variant;
      const suffix = Object.values(attrs).filter((v) => /\d/.test(v)).slice(0, 2).join(" ");
      const name = `${type} ${brand} ${model}${suffix ? ` ${suffix}` : ""}`;
      const price = roundPrice(base * (1 + index * 0.18));
      const onSale = random() < 0.15;
      const stockRoll = random();
      const pool = images[spec.group] ?? [];
      records.push({
        navkoloId: `${PREFIX}-${number}`,
        sku: `${PREFIX.toUpperCase()}-${number}`,
        name,
        groupRef: spec.sub,
        price,
        oldPrice: onSale ? roundPrice(price * between(1.1, 1.35)) : null,
        stock: stockRoll < 0.12 ? 0 : stockRoll < 0.2 ? Math.ceil(random() * 3) : Math.round(between(4, 150)),
        brand,
        variantGroup,
        variantLabel: variantGroup ? variant : null,
        description: `${pick(DESCRIPTIONS)(name, brand)} ${pick(DESCRIPTIONS)(name, brand)}`,
        attributes: Object.entries(attrs).map(([attrName, value]) => ({ name: attrName, value })),
        imageUrls: pool.length ? [pick(pool), ...(random() < 0.3 ? [pick(pool)] : [])] : [],
      });
    });
  }
  return { records, subs };
}

function slugify(value) {
  const map = { а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", "'": "" };
  return value.toLowerCase().split("").map((c) => map[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function ensureSubcategories(api, subs, withFilters) {
  const categories = await api.json("/api/v1/console/catalog/categories");
  const tops = Object.fromEntries(categories.filter((c) => !c.parentId).map((c) => [c.navkoloRef ?? c.name, c]));
  let created = 0;
  let updated = 0;
  for (const [index, spec] of subs.entries()) {
    const parent = tops[spec.group];
    if (!parent) throw new Error(`Немає верхньої категорії «${spec.group}»`);
    const existing = categories.find((c) => c.parentId === parent.id && (c.navkoloRef === spec.sub || c.name === spec.sub));
    const body = {
      parentId: parent.id,
      name: spec.sub,
      slug: existing?.slug ?? slugify(spec.sub),
      sortOrder: existing?.sortOrder ?? index + 1,
      isVisible: existing?.isVisible ?? true,
      navkoloRef: spec.sub,
      filterAttributes: withFilters ? Object.keys(spec.attrs) : existing?.filterAttributes ?? [],
      seoTitle: existing?.seoTitle ?? null,
      seoDescription: existing?.seoDescription ?? null,
      imageUrl: existing?.imageUrl ?? null,
      description: existing?.description ?? null,
    };
    if (!existing) {
      await api.json("/api/v1/console/catalog/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      created += 1;
    } else if (withFilters) {
      await api.json(`/api/v1/console/catalog/categories/${existing.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      updated += 1;
    }
  }
  console.log(`Підкатегорії: створено ${created}, оновлено фільтри ${updated}`);
}

async function importChunks(api, records) {
  for (let i = 0; i < records.length; i += CHUNK) {
    const part = records.slice(i, i + CHUNK);
    const form = new FormData();
    form.append("file", new Blob([JSON.stringify(part)], { type: "application/json" }), `${PREFIX}-${i / CHUNK + 1}.json`);
    const started = performance.now();
    const run = await api.json("/api/v1/console/integration/navkolo/import", { method: "POST", body: form });
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`Частина ${i / CHUNK + 1}: ${part.length} рядків, ${seconds} с, статус ${run.status}, помилок ${run.errorCount}. ${run.summary ?? ""}`);
  }
}

const { records, subs } = buildRecords();
const variants = records.filter((r) => r.variantGroup).length;
console.log(`Згенеровано ${records.length} товарів у ${subs.length} підкатегоріях, з них у варіантах ${variants}, зі знижкою ${records.filter((r) => r.oldPrice).length}, без залишку ${records.filter((r) => r.stock === 0).length}`);

if (!DRY) {
  const api = new ConsoleClient(BASE, HOST);
  await api.login();
  await ensureSubcategories(api, subs, false);
  const started = performance.now();
  await importChunks(api, records);
  console.log(`Імпорт: ${((performance.now() - started) / 1000).toFixed(1)} с`);
  await ensureSubcategories(api, subs, true);
}
