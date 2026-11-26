/** How the services page groups the service directions (the API knows only the services themselves). */
export const serviceGroups = [
  { key: "landscape", label: "Облаштування", title: "Облаштування ділянки", photo: "/brand/garden-services.webp", codes: ["landscape-design", "greening", "lawns"] },
  { key: "irrigation", label: "Автополив", title: "Системи поливу", photo: "/brand/service-irrigation.webp", codes: ["irrigation-installation", "irrigation-service"] },
  { key: "care", label: "Догляд", title: "Догляд за рослинами", photo: "/brand/service-planting.webp", codes: ["garden-care", "plant-treatment"] },
];

export const otherServicesGroup = { key: "other", label: "Інші роботи", title: "Інші садові роботи", photo: "/brand/garden-services.webp" };

export function serviceGroupOf(code: string) {
  return serviceGroups.find((group) => group.codes.includes(code)) ?? { ...otherServicesGroup, codes: [code] };
}

export const servicePath = (slug: string) => `/services/${slug}`;

export const serviceRequestHref = (code: string) => `/contacts?direction=${encodeURIComponent(code)}#request`;
