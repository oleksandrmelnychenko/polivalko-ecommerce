export const DEFAULT_GOOGLE_PRODUCT_CATEGORY = "Home & Garden > Lawn & Garden";

// Official Google Product Taxonomy paths (verified against taxonomy-with-ids.en-US.txt)
// used by both Schema.org Product.category and Google Merchant Center g:google_product_category.
const GOOGLE_TAXONOMY_BY_SLUG: Readonly<Record<string, string>> = {
  "vse-dlia-polyvu": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "nazemnyi-polyv": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "pidzemnyi-polyv": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "hunter": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "irritec": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "inshi-brendy-pidzemnoho-polyvu": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "krapelnyi-polyv": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "vizky-dlia-shlanhu": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "shlanhy": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hoses",
  "shlanhy-dlia-polyvu": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hoses",
  "ziednuvachi-y-perekhidnyky": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hose Fittings & Valves",
  "truby-krany-y-fum-strichka": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hose Fittings & Valves",
  "doshchuvachi": "Home & Garden > Lawn & Garden > Watering & Irrigation > Sprinklers & Sprinkler Heads",
  "rozpyliuvachi-i-pistolety": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hose Spray Nozzles",
  "vse-dlia-roslyn": "Home & Garden > Lawn & Garden > Gardening",
  "nasinnia": "Home & Garden > Plants > Seeds",
  "nabory-nasinnia": "Home & Garden > Plants > Seeds",
  "nasinnia-hazonnykh-trav": "Home & Garden > Plants > Seeds",
  "roslyny": "Home & Garden > Plants",
  "dobryva": "Home & Garden > Lawn & Garden > Gardening > Fertilizers",
  "biopreparaty": "Home & Garden > Lawn & Garden > Gardening > Fertilizers",
  "rehuliatory-rostu-y-prylypachi": "Home & Garden > Lawn & Garden > Gardening > Fertilizers",
  "hrunty-ta-dobavky": "Home & Garden > Lawn & Garden > Gardening > Sands & Soils",
  "horshchyky": "Home & Garden > Lawn & Garden > Gardening > Pots & Planters",
  "kompozytni-hriadky": "Home & Garden > Lawn & Garden > Gardening > Pots & Planters",
  "herbitsydy": "Home & Garden > Lawn & Garden > Gardening > Herbicides",
  "zasoby-zakhystu-roslyn": "Home & Garden > Lawn & Garden > Gardening > Disease Control",
  "funhitsydy": "Home & Garden > Lawn & Garden > Gardening > Disease Control",
  "protruinyky": "Home & Garden > Lawn & Garden > Gardening > Disease Control",
  "kompleksni-zasoby-y-nabory": "Home & Garden > Lawn & Garden > Gardening > Disease Control",
  "pobilka-y-sadovyi-var": "Home & Garden > Lawn & Garden > Gardening > Disease Control",
  "shkidnyky": "Home & Garden > Household Supplies > Pest Control",
  "insektytsydy-y-akarytsydy": "Home & Garden > Household Supplies > Pest Control",
  "zasoby-zakhystu-liudei": "Home & Garden > Household Supplies > Pest Control",
  "ruchnyi-instrument": "Home & Garden > Lawn & Garden > Gardening > Gardening Tools",
  "velykyi-ruchnyi-instrument": "Home & Garden > Lawn & Garden > Gardening > Gardening Tools",
  "dribnyi-ruchnyi-instrument": "Home & Garden > Lawn & Garden > Gardening > Gardening Tools",
  "sekatory-suchkorizy-y-nozhytsi": "Home & Garden > Lawn & Garden > Gardening > Gardening Tools",
  "sokyry-pyly-y-nozhi": "Home & Garden > Lawn & Garden > Gardening > Gardening Tools",
  "opryskuvachi-liiky-y-vidra": "Home & Garden > Lawn & Garden > Gardening > Gardening Tools > Lawn & Garden Sprayers",
  "tekhnika-dlia-sadu-ta-horodu": "Home & Garden > Lawn & Garden > Outdoor Power Equipment",
  "tekhnika": "Home & Garden > Lawn & Garden > Outdoor Power Equipment",
  "vytratni-materialy": "Home & Garden > Lawn & Garden > Outdoor Power Equipment Accessories",
  "vse-dlia-vidpochynku": "Home & Garden > Lawn & Garden > Outdoor Living",
  "pryladdia-dlia-pryhotuvannia-yizhi": "Home & Garden > Lawn & Garden > Outdoor Living",
  "vuhillia-brykety-y-rozpaliuvachi": "Home & Garden > Lawn & Garden > Outdoor Living",
  "hazova-produktsiia": "Home & Garden > Lawn & Garden > Outdoor Living",
  "izotermichna-produktsiia": "Home & Garden > Lawn & Garden > Outdoor Living",
  "tovary-dlia-vidpochynku": "Home & Garden > Lawn & Garden > Outdoor Living",
  "baseiny": "Home & Garden > Pool & Spa",
  "khimiia-dlia-baseiniv": "Home & Garden > Pool & Spa > Pool & Spa Accessories",
  "hospodarchi-tovary": "Home & Garden > Household Supplies",
  "hospodarski-dribnytsi": "Home & Garden > Household Supplies",
  "materialy-dlia-pakuvannia": "Home & Garden > Household Supplies",
  "vse-dlia-prybyrannia": "Home & Garden > Household Supplies > Household Cleaning Supplies",
  "septyky-y-kompost": "Home & Garden > Lawn & Garden > Gardening > Composting",
  "avtotovary": "Vehicles & Parts > Vehicle Parts & Accessories",
  "obihrivachi": "Home & Garden > Household Appliances > Climate Control Appliances > Space Heaters",
  "landshaftnyi-dyzain": "Home & Garden > Lawn & Garden",
  "shtuchne-pokryttia": "Home & Garden > Lawn & Garden",
  "bordiury-i-ohorozhi": "Hardware > Fencing & Barriers",
  "opory-dlia-roslyn": "Home & Garden > Lawn & Garden > Gardening > Plant Cages & Supports",
  "ukryvni-materialy": "Home & Garden > Lawn & Garden > Gardening > Landscape Fabric",
  "elementy-osvitlennia": "Home & Garden > Lighting",
  "hodivnytsi": "Home & Garden > Decor > Bird & Wildlife Feeders > Bird Feeders",
  "novyi-rik": "Home & Garden > Decor > Seasonal & Holiday Decorations",
  "ialynky": "Home & Garden > Decor > Seasonal & Holiday Decorations",
  "hirliandy": "Home & Garden > Decor > Seasonal & Holiday Decorations",
  "vinky": "Home & Garden > Decor > Seasonal & Holiday Decorations",
  "fihury-i-suveniry": "Home & Garden > Decor > Seasonal & Holiday Decorations",
  "prykrasy": "Home & Garden > Decor > Seasonal & Holiday Decorations > Holiday Ornaments",
};

const GOOGLE_TAXONOMY_BY_NAME: Readonly<Record<string, string>> = {
  "візки для шлангу": "Home & Garden > Lawn & Garden > Watering & Irrigation",
  "з'єднувачі й перехідники": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hose Fittings & Valves",
  "труби, крани й фум-стрічка": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hose Fittings & Valves",
  "розпилювачі й пістолети": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hose Spray Nozzles",
  "розпилювачі і пістолети": "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hose Spray Nozzles",
  "все для рослин": "Home & Garden > Lawn & Garden > Gardening",
  "рослини": "Home & Garden > Plants",
  "біопрепарати": "Home & Garden > Lawn & Garden > Gardening > Fertilizers",
  "регулятори росту й прилипачі": "Home & Garden > Lawn & Garden > Gardening > Fertilizers",
  "композитні грядки": "Home & Garden > Lawn & Garden > Gardening > Pots & Planters",
  "комплексні засоби й набори": "Home & Garden > Lawn & Garden > Gardening > Disease Control",
  "побілка й садовий вар": "Home & Garden > Lawn & Garden > Gardening > Disease Control",
  "засоби захисту людей": "Home & Garden > Household Supplies > Pest Control",
  "оприскувачі, лійки й відра": "Home & Garden > Lawn & Garden > Gardening > Gardening Tools > Lawn & Garden Sprayers",
  "обприскувачі, лійки й відра": "Home & Garden > Lawn & Garden > Gardening > Gardening Tools > Lawn & Garden Sprayers",
  "витратні матеріали": "Home & Garden > Lawn & Garden > Outdoor Power Equipment Accessories",
  "приладдя для приготування їжі": "Home & Garden > Lawn & Garden > Outdoor Living",
  "вугілля, брикети й розпалювачі": "Home & Garden > Lawn & Garden > Outdoor Living",
  "газова продукція": "Home & Garden > Lawn & Garden > Outdoor Living",
  "ізотермічна продукція": "Home & Garden > Lawn & Garden > Outdoor Living",
  "хімія для басейнів": "Home & Garden > Pool & Spa > Pool & Spa Accessories",
  "матеріали для пакування": "Home & Garden > Household Supplies",
  "септики й компост": "Home & Garden > Lawn & Garden > Gardening > Composting",
  "автотовари": "Vehicles & Parts > Vehicle Parts & Accessories",
  "обігрівачі": "Home & Garden > Household Appliances > Climate Control Appliances > Space Heaters",
  "бордюри й огорожі": "Hardware > Fencing & Barriers",
  "бордюри і огорожі": "Hardware > Fencing & Barriers",
  "опори для рослин": "Home & Garden > Lawn & Garden > Gardening > Plant Cages & Supports",
  "укривні матеріали": "Home & Garden > Lawn & Garden > Gardening > Landscape Fabric",
  "елементи освітлення": "Home & Garden > Lighting",
  "годівниці": "Home & Garden > Decor > Bird & Wildlife Feeders > Bird Feeders",
  "вінки": "Home & Garden > Decor > Seasonal & Holiday Decorations",
  "фігури й сувеніри": "Home & Garden > Decor > Seasonal & Holiday Decorations",
  "прикраси": "Home & Garden > Decor > Seasonal & Holiday Decorations > Holiday Ornaments",
};

function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/[\u2018\u2019\u02BC`]/g, "'").replace(/\s+/g, " ");
}

function matchSpecificCategory(category?: { slug?: string | null; name?: string | null } | null): string | null {
  const slug = category?.slug?.trim().toLowerCase() ?? "";
  if (slug && GOOGLE_TAXONOMY_BY_SLUG[slug]) return GOOGLE_TAXONOMY_BY_SLUG[slug];

  const normalizedName = category?.name ? normalizeCategoryName(category.name) : "";
  if (normalizedName && GOOGLE_TAXONOMY_BY_NAME[normalizedName]) return GOOGLE_TAXONOMY_BY_NAME[normalizedName];

  const haystack = `${slug} ${normalizedName}`;
  if (slug.startsWith("nasinnia-") || /насіння/u.test(haystack)) return "Home & Garden > Plants > Seeds";
  if (/шлан|shlanh/u.test(haystack)) return "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hoses";
  if (/дощув|doshchuv/u.test(haystack)) return "Home & Garden > Lawn & Garden > Watering & Irrigation > Sprinklers & Sprinkler Heads";
  if (/полив|polyv|hunter|irritec/u.test(haystack)) return "Home & Garden > Lawn & Garden > Watering & Irrigation";
  if (/добрив|dobryv/u.test(haystack)) return "Home & Garden > Lawn & Garden > Gardening > Fertilizers";
  if (/ґрунт|грунт|hrunt/u.test(haystack)) return "Home & Garden > Lawn & Garden > Gardening > Sands & Soils";
  if (/горщик|horshch/u.test(haystack)) return "Home & Garden > Lawn & Garden > Gardening > Pots & Planters";
  if (/гербіцид|herbitsyd/u.test(haystack)) return "Home & Garden > Lawn & Garden > Gardening > Herbicides";
  if (/шкідник|shkidnyk|інсектиц|insektyts/u.test(haystack)) return "Home & Garden > Household Supplies > Pest Control";
  if (/захист.*рослин|фунгіцид|протруй/u.test(haystack)) return "Home & Garden > Lawn & Garden > Gardening > Disease Control";
  if (/інструмент|секатор|сучкоріз|сокир|пил|instrument|sekator/u.test(haystack)) return "Home & Garden > Lawn & Garden > Gardening > Gardening Tools";
  if (/технік|tekhnik/u.test(haystack)) return "Home & Garden > Lawn & Garden > Outdoor Power Equipment";
  if (/басейн|basein/u.test(haystack)) return "Home & Garden > Pool & Spa";
  if (/відпочин|vidpochyn|гриль|мангал/u.test(haystack)) return "Home & Garden > Lawn & Garden > Outdoor Living";
  if (/новий рік|ялинк|гірлянд|прикрас|novyi-rik|ialynk/u.test(haystack)) return "Home & Garden > Decor > Seasonal & Holiday Decorations";
  if (/прибиран|prybyran/u.test(haystack)) return "Home & Garden > Household Supplies > Household Cleaning Supplies";
  if (/господар|hospodar/u.test(haystack)) return "Home & Garden > Household Supplies";

  return null;
}

export function googleProductCategory(category?: { slug?: string | null; name?: string | null } | null): string {
  return matchSpecificCategory(category) ?? DEFAULT_GOOGLE_PRODUCT_CATEGORY;
}

export function googleProductCategoryFromPath(categoryPath?: ReadonlyArray<string> | null): string {
  if (!categoryPath || categoryPath.length === 0) return DEFAULT_GOOGLE_PRODUCT_CATEGORY;
  for (let index = categoryPath.length - 1; index >= 0; index -= 1) {
    const matched = matchSpecificCategory({ name: categoryPath[index] });
    if (matched) return matched;
  }
  return DEFAULT_GOOGLE_PRODUCT_CATEGORY;
}
