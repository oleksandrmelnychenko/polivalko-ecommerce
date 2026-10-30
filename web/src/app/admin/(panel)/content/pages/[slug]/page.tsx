"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData, useStaff } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { StateBox } from "../../../ui";
import { Field, FormStatus, SaveButton, useAdminForm } from "../../_lib";

type Page = components["schemas"]["PageDto"];

export default function AdminPageEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = useAdminData(slug, () => browserApi.GET("/api/v1/admin/content/pages/{slug}", { params: { path: { slug } } }));
  // Хто редагував останнім, знає лише список сторінок.
  const list = useAdminData("pages", () => browserApi.GET("/api/v1/admin/content/pages"));
  const updatedBy = list.data?.find((p) => p.slug === slug)?.updatedBy ?? null;

  return (
    <>
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/admin/content">Сторінки</Link>
          </li>
          <li aria-current="page">{page.data?.title ?? slug}</li>
        </ol>
      </nav>
      <StateBox state={page}>{page.data && <Editor key={page.data.slug} initial={page.data} updatedBy={updatedBy} onSaved={page.setData} />}</StateBox>
    </>
  );
}

function Editor({ initial, updatedBy, onSaved }: { initial: Page; updatedBy: string | null; onSaved: (page: Page) => void }) {
  const { me } = useStaff();
  const form = useAdminForm();
  const [saved, setSaved] = useState(initial);
  const [savedBy, setSavedBy] = useState<string | null>(null);
  const [title, setTitle] = useState(initial.title);
  const [lead, setLead] = useState(initial.lead ?? "");
  const [body, setBody] = useState(initial.bodyHtml ?? "");
  const draft = useDeferredValue(body);

  const dirty = title !== saved.title || lead !== (saved.lead ?? "") || body !== (saved.bodyHtml ?? "");
  const draftShown = draft !== (saved.bodyHtml ?? "");
  const who = savedBy ?? updatedBy;

  // Незбережений текст не губимо випадковим закриттям вкладки.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit(
      (headers) =>
        browserApi.PUT("/api/v1/admin/content/pages/{slug}", {
          params: { path: { slug: saved.slug } },
          headers,
          body: { title: title.trim(), lead: lead.trim() || null, bodyHtml: body.trim() || null },
        }),
      { done: "Сторінку збережено. У полі тепер текст після очищення сервером.", failed: "Сторінку не збережено." },
    );
    if (!result?.data) return;
    // Показуємо саме те, що зберіг сервер: заборонена розмітка вже прибрана.
    const page = result.data;
    setSaved(page);
    setSavedBy(me.displayName);
    setTitle(page.title);
    setLead(page.lead ?? "");
    setBody(page.bodyHtml ?? "");
    onSaved(page);
  }

  return (
    <form className="admin-form" onSubmit={onSubmit} noValidate>
      <div className="admin-order-head">
        <h1 className="admin-title">{saved.title}</h1>
        <span className="muted">
          оновлено {formatDateTime(saved.updatedAt)}
          {who && `, ${who}`}
        </span>
      </div>

      <div className="admin-editor">
        <div className="admin-form">
          <Field id="title" label="Заголовок" errors={form.errors.title}>
            {(a11y) => <input {...a11y} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />}
          </Field>
          <Field id="lead" label="Підзаголовок" help="Абзац під заголовком, до 500 символів. Можна лишити порожнім." errors={form.errors.lead}>
            {(a11y) => <textarea {...a11y} rows={3} value={lead} onChange={(e) => setLead(e.target.value)} maxLength={500} />}
          </Field>
          <Field
            id="bodyHtml"
            label="Текст сторінки, HTML"
            help="Дозволено абзаци, заголовки h2–h4, списки, цитати, таблиці й посилання (http, https, mailto, tel). Решту розмітки, стилі й скрипти сервер прибирає під час збереження."
            errors={form.errors.bodyHtml}
          >
            {(a11y) => (
              <textarea
                {...a11y}
                className="admin-code-input"
                rows={24}
                spellCheck={false}
                autoCapitalize="off"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            )}
          </Field>
          <FormStatus form={form} />
          <div className="admin-actions">
            <SaveButton busy={form.busy} disabled={!dirty} />
            <a href={`/${saved.slug}`} className="btn btn--small btn--quiet" target="_blank" rel="noopener">
              Відкрити на сайті
            </a>
          </div>
        </div>

        <section className="admin-preview" aria-labelledby="preview-title">
          <div className="admin-preview__head">
            <h2 id="preview-title">Перегляд</h2>
            <span className={draftShown ? "status status--attention" : "muted"}>{draftShown ? "чернетка, не збережена" : "збережена версія"}</span>
          </div>
          <p className="admin-preview__title">{title || "Без заголовка"}</p>
          {lead && <p className="lead">{lead}</p>}
          {draftShown ? (
            <>
              {/* Чернетка ще не очищена сервером: показуємо її в ізольованій рамці без скриптів, а не в DOM адмінки. */}
              <iframe className="admin-preview__frame" title="Чернетка тексту сторінки" sandbox="" srcDoc={previewDocument(draft)} />
              <p className="field__help">Після збереження сервер прибере недозволену розмітку, і тут з&apos;явиться збережена версія.</p>
            </>
          ) : saved.bodyHtml ? (
            <div className="prose" dangerouslySetInnerHTML={{ __html: saved.bodyHtml }} />
          ) : (
            <p className="muted">Текст порожній: вітрина покаже заглушку «Текст готує магазин».</p>
          )}
        </section>
      </div>
    </form>
  );
}

/** Окремий документ для рамки: власні стилі як у `.prose` вітрини й CSP, що забороняє будь-які завантаження. */
function previewDocument(html: string): string {
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
