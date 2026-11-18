export type HtmlSection = { title: string; html: string };

const HEADING = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;

const NAMED: Record<string, string> = {
  amp: "&",
  nbsp: " ",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  laquo: "«",
  raquo: "»",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

const fromCode = (code: number) => (code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "");

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity: string, body: string) => {
    if (body[0] !== "#") return NAMED[body.toLowerCase()] ?? entity;
    return fromCode(body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : Number(body.slice(1)));
  });
}

const headingText = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

export function htmlSections(html: string): { intro: string; sections: HtmlSection[] } {
  const matches = [...html.matchAll(HEADING)];
  if (matches.length === 0) return { intro: html, sections: [] };
  const intro = html.slice(0, matches[0].index).trim();
  const sections = matches.map((match, i) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    return { title: headingText(match[2]), html: html.slice(start, end).trim() };
  });
  return { intro, sections: sections.filter((s) => s.title) };
}
