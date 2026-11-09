export type HtmlSection = { title: string; html: string };

const HEADING = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;

export function htmlSections(html: string): { intro: string; sections: HtmlSection[] } {
  const matches = [...html.matchAll(HEADING)];
  if (matches.length === 0) return { intro: html, sections: [] };
  const intro = html.slice(0, matches[0].index).trim();
  const sections = matches.map((match, i) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    return { title: match[2].replace(/<[^>]+>/g, "").trim(), html: html.slice(start, end).trim() };
  });
  return { intro, sections: sections.filter((s) => s.title) };
}
