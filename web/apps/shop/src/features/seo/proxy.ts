import { NextResponse, type NextRequest } from "next/server";
import { STREAMING_METADATA_MARK } from "@/shared/lib/streaming-metadata";

/**
 * Pages whose shell the build prerenders and whose metadata is part of it: it lands in <head> whether Next.js streams
 * the page or waits for the metadata (checked for each). Only these answer people with the shell at once.
 * A listing or an info page is not here: its metadata depends on the request and would stream into <body>.
 * Product and service pages keep their metadata in <head> too, but have no shell until their first visit, which then
 * waits to build one. Tried for products on 2026-11-27: a repeat visit gained ~60 ms, a first visit lost ~140 ms, and
 * shells go with every deploy, so most visits to a large, rarely visited catalog were first visits. They stay out.
 */
const STREAMABLE = new Set(["/", "/about", "/contacts", "/blog", "/services"]);
const ARTICLE = /^\/blog\/[^/]+$/;

// Anything that may read the HTML without running it: search engines, SEO tools, link previews in messengers and
// social networks, scripts. They keep the metadata in <head> before the page starts, as before.
const READER = /bot|crawl|spider|slurp|preview|lighthouse|headless|google|bing|yandex|baidu|duckduck|ahrefs|semrush|facebook|whatsapp|telegram|viber|skype|slack|discord|linkedin|pinterest|vkshare|embedly|quora|tumblr|outbrain|petal|seznam|curl|wget|python|java|go-http|okhttp|axios|node|httpclient|libwww|scrapy/i;

/** Marks a person's request for a streamable page; undefined leaves the request as it came. */
export function markStreamingMetadata(request: NextRequest) {
  const agent = request.headers.get("user-agent") ?? "";
  if (!agent.startsWith("Mozilla/5.0") || READER.test(agent)) return undefined;
  const { pathname } = request.nextUrl;
  if (!STREAMABLE.has(pathname) && !ARTICLE.test(pathname)) return undefined;
  const headers = new Headers(request.headers);
  headers.set("user-agent", `${agent} ${STREAMING_METADATA_MARK}`);
  return NextResponse.next({ request: { headers } });
}
