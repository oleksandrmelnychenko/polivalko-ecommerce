export function directionsUrl(mapUrl?: string | null, address?: string | null) {
  if (mapUrl?.trim()) return mapUrl.trim();
  const destination = address?.trim();
  if (!destination) return null;
  return "https://www.google.com/maps/dir/?" + new URLSearchParams({ api: "1", destination });
}
