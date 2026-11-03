"use client";

import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { useStaff } from "@/features/admin/auth";
import { Field } from "@/shared/admin/form/field";
import { FormStatus } from "@/shared/admin/form/form-status";
import { SaveButton } from "@/shared/admin/form/save-button";
import { useAdminForm } from "@/shared/admin/form/use-admin-form";
import type { components } from "@/shared/api/schema";
import { formatDateTime } from "@/shared/lib/format";
import { savePage } from "../api/client";
import { previewDocument } from "../lib/preview";

type Page = components["schemas"]["PageDto"];

export function PageEditor({ initial, updatedBy, onSaved }: { initial: Page; updatedBy: string | null; onSaved: (page: Page) => void }) {
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

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit(
      (headers) => savePage(headers, saved.slug, { title: title.trim(), lead: lead.trim() || null, bodyHtml: body.trim() || null }),
      { done: "Сторінку збережено. У полі тепер текст після очищення сервером.", failed: "Сторінку не збережено." },
    );
    if (!result?.data) return;
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
