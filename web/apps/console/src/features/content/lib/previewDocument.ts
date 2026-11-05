export function previewDocument(html: string): string {
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>${previewCss}</style></head><body>${html}</body></html>`
}

const previewCss = [
  'body{margin:0;padding:14px 16px;font:15px/1.65 Onest,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1a1a1a;background:#fff}',
  'body>*{margin:0}body>*+*{margin-top:12px}',
  'h2{margin-top:28px;font-size:20px;font-weight:600;line-height:1.25}',
  'h3,h4{margin-top:20px;font-size:17px;font-weight:600;line-height:1.3}',
  'ul,ol{padding-left:1.25em}li+li{margin-top:4px}',
  'blockquote{margin-inline:0;padding-left:14px;border-left:3px solid #00a046}',
  'table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{padding:6px 12px 6px 0;border-bottom:1px solid #e9ecef;text-align:left;vertical-align:top}',
  'a{color:#008a3c;text-decoration:underline;text-underline-offset:.15em}',
  'body>:first-child{margin-top:0}',
].join('')
