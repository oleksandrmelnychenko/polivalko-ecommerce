export function previewDocument(html: string): string {
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>${previewCss}</style></head><body>${html}</body></html>`;
}

const previewCss = [
  "body{margin:0;padding:0 2px;font:16px/1.55 ui-sans-serif,system-ui,sans-serif;color:oklch(18% 0.008 150);background:oklch(99.6% 0.002 150)}",
  "body>*{margin:0}body>*+*{margin-top:12px}",
  "h2{margin-top:40px;font-size:1.4rem;font-weight:500;line-height:1.25}",
  "h3,h4{margin-top:24px;font-size:1.25rem;font-weight:500;line-height:1.3}",
  "ul,ol{padding-left:1.25em}li+li{margin-top:4px}",
  "blockquote{margin-inline:0;padding-left:16px;border-left:2px solid oklch(18% 0.008 150)}",
  "table{width:100%;border-collapse:collapse}th,td{padding:8px 12px 8px 0;border-bottom:1px solid oklch(88.5% 0.005 150);text-align:left}",
  "a{color:oklch(48.3% 0.133 150)}",
].join("");
