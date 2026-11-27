/**
 * Where Next.js may stream a page's metadata instead of writing it into <head> before the page starts.
 *
 * Next.js waits for `generateMetadata` before answering the user agents `htmlLimitedBots` matches, and serves the
 * others the page's prerendered shell at once. The shop matches every user agent except those the proxy marks
 * (see `features/seo/proxy.ts`): people on pages whose metadata is part of the shell, so it is in <head> either way.
 * Elsewhere (catalog listings, «Акції», the info pages) the metadata depends on the request and would stream into
 * <body>; those pages, and every crawler and link preview, keep the metadata in <head> before the page starts.
 * The CDN keeps one copy per address whoever asked, so a page is only marked when both copies carry the same <head>.
 */
export const STREAMING_METADATA_MARK = "PoliValko-Streaming-Metadata";

/** Every user agent without the mark waits for the metadata: the value of `htmlLimitedBots`. */
export const BLOCKING_METADATA_AGENTS = new RegExp(`^(?![\\s\\S]*${STREAMING_METADATA_MARK})`);
