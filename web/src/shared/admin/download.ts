export async function downloadFile(url: string, fallbackName: string): Promise<boolean> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) return false;
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(response.headers.get("content-disposition") ?? "")?.[1];
  const href = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = name ? decodeURIComponent(name) : fallbackName;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return true;
}
