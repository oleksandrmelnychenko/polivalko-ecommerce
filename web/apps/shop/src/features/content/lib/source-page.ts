export function sourcePage(url: string): string {
  const unsplash = url.match(/^https:\/\/images\.unsplash\.com\/(photo-[\w-]+)/);
  return unsplash ? `https://unsplash.com/photos/${unsplash[1].replace(/^photo-/, "")}` : url;
}
