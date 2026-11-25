// The production Vercel Blob store that holds catalog photos (see ProductPhotoStorage in the API).
// Only its photos are resized by the Next.js image optimizer: next.config.ts allows this host alone,
// so other Blob stores cannot spend the optimizer quota. Photos from any other host are shown as stored.
export const CATALOG_PHOTO_HOST = "jdzb1ubelhmup6rk.public.blob.vercel-storage.com";
