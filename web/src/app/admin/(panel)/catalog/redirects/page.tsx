"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import { useAdminData } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { StateBox } from "../../ui";
import { AdminOnly, CatalogTabs, FieldError, fieldErrors, mutate, problemTitle } from "../_shared";

/** Постійні перенаправлення (розділ 10 ТЗ): автоматичні після зміни адреси та ручні для старих посилань. */
export default function AdminRedirectsPage() {
  return (
    <>
      <h1 className="admin-title">Каталог</h1>
      <CatalogTabs />
      <AdminOnly>
        <Redirects />
      </AdminOnly>
    </>
  );
}

function Redirects() {
  const redirects = useAdminData("redirects", () => browserApi.GET("/api/v1/admin/catalog/redirects"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await mutate((headers) =>
      browserApi.POST("/api/v1/admin/catalog/redirects", {
        headers,
        body: { fromPath: String(form.get("fromPath") ?? ""), toPath: String(form.get("toPath") ?? "") },
      }),
    );
    if (result.data) {
      formElement.reset();
      setErrors({});
      setError(null);
      redirects.reload();
    } else {
      setErrors(fieldErrors(result.error));
      setError(problemTitle(result.error, "Не збережено."));
    }
  }

  async function remove(id: string) {
    const result = await mutate((headers) => browserApi.DELETE("/api/v1/admin/catalog/redirects/{id}", { params: { path: { id } }, headers }));
    if (result.response.ok) redirects.reload();
    else setError(problemTitle(result.error, "Не видалено."));
  }

  return (
    <>
      <form className="admin-filters" onSubmit={create} noValidate>
        <div className="field">
          <label htmlFor="fromPath">Стара адреса</label>
          <input id="fromPath" name="fromPath" placeholder="/product/stara-adresa" required aria-describedby={errors.fromPath ? "fromPath-error" : undefined} />
          <FieldError id="fromPath-error" message={errors.fromPath} />
        </div>
        <div className="field">
          <label htmlFor="toPath">Нова адреса</label>
          <input id="toPath" name="toPath" placeholder="/product/nova-adresa" required aria-describedby={errors.toPath ? "toPath-error" : undefined} />
          <FieldError id="toPath-error" message={errors.toPath} />
        </div>
        <button type="submit" className="btn btn--small">
          Додати
        </button>
      </form>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <StateBox state={redirects} empty={redirects.data?.length === 0 ? "Перенаправлень ще немає: вони з'являються після зміни адреси товару чи розділу." : undefined}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Стара адреса</th>
                <th scope="col">Нова адреса</th>
                <th scope="col">Як створено</th>
                <th scope="col">
                  <span className="visually-hidden">Дія</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {redirects.data?.map((r) => (
                <tr key={r.id}>
                  <td className="code">{r.fromPath}</td>
                  <td className="code">{r.toPath}</td>
                  <td>
                    {r.isAutomatic ? "Автоматично" : "Вручну"}, {formatDateTime(r.createdAt)}
                  </td>
                  <td>
                    <button type="button" className="btn btn--small btn--quiet" onClick={() => remove(r.id)}>
                      Видалити
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateBox>
    </>
  );
}
