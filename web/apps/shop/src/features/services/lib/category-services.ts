/**
 * Which service a catalog section leads to: someone buying sprinklers may rather have the system installed.
 * A section without its own entry takes its nearest parent's, so new subsections are covered too.
 */
const serviceByCategory: Record<string, string> = {
  // Watering
  "vse-dlia-polyvu": "irrigation-installation",
  "pidzemnyi-polyv": "irrigation-installation",
  hunter: "irrigation-installation",
  irritec: "irrigation-installation",
  "inshi-brendy-pidzemnoho-polyvu": "irrigation-installation",
  "krapelnyi-polyv": "irrigation-installation",
  doshchuvachi: "irrigation-installation",
  "truby-krany-y-fum-strichka": "irrigation-installation",
  // Landscaping
  "landshaftnyi-dyzain": "landscape-design",
  "bordiury-i-ohorozhi": "landscape-design",
  "elementy-osvitlennia": "landscape-design",
  "kompozytni-hriadky": "landscape-design",
  "nasinnia-hazonnykh-trav": "lawns",
  // Plants and their care
  "vse-dlia-roslyn": "greening",
  roslyny: "greening",
  dobryva: "garden-care",
  "sekatory-suchkorizy-y-nozhytsi": "garden-care",
  "zasoby-zakhystu-roslyn": "plant-treatment",
  "opryskuvachi-liiky-y-vidra": "plant-treatment",
  shkidnyky: "plant-treatment",
};

/** The service code for a section, looking at the section itself first and then up its breadcrumbs. */
export function serviceCodeForCategory(slug: string, ancestors: readonly { slug: string }[]): string | null {
  for (const candidate of [slug, ...ancestors.map((a) => a.slug).reverse()]) {
    const code = serviceByCategory[candidate];
    if (code) return code;
  }
  return null;
}
