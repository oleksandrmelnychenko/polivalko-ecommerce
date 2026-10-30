"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import { useAdminData, useStaff } from "@/lib/admin";
import { Modal, PageHead, StateBox } from "../ui";
import { problemOf, problemText, withCsrf } from "../content/_lib";
import { CreateUserForm, EditUserForm, OwnPasswordForm, ResetPasswordForm, roleLabel, roleOf, type StaffUser } from "./forms";

type Dialog = { kind: "create" } | { kind: "own" } | { kind: "edit" | "password"; user: StaffUser };

export default function AdminStaffPage() {
  const { isAdmin } = useStaff();
  // Менеджер потрапляє сюди лише за прямою адресою: йому доступна тільки зміна власного пароля.
  if (!isAdmin)
    return (
      <>
        <h1 className="admin-title">Мій пароль</h1>
        <div className="admin-panel admin-narrow">
          <OwnPasswordForm />
        </div>
      </>
    );
  return <Staff />;
}

/** Працівники: список на всю ширину, а додавання, зміна даних і паролів — у модальних вікнах. */
function Staff() {
  const { me } = useStaff();
  const users = useAdminData("users", () => browserApi.GET("/api/v1/admin/users"));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  function replace(user: StaffUser) {
    if (users.data) users.setData(users.data.map((u) => (u.id === user.id ? user : u)));
  }

  function open(next: Dialog) {
    setNotice(null);
    setDialog(next);
  }

  function done(text: string) {
    setDialog(null);
    setNotice({ ok: true, text });
  }

  async function lock(user: StaffUser) {
    const locked = !user.lockedOut;
    if (locked && !window.confirm(`Заблокувати доступ для ${user.displayName}? Працівник не зможе увійти, активні сесії завершаться.`)) return;
    setBusy(user.id);
    setNotice(null);
    try {
      const result = await withCsrf((headers) =>
        browserApi.POST("/api/v1/admin/users/{id}/lock", { params: { path: { id: user.id } }, headers, body: { locked } }),
      );
      if (result.data) {
        replace(result.data);
        setNotice({ ok: true, text: locked ? `Доступ для ${user.displayName} заблоковано.` : `Доступ для ${user.displayName} відновлено.` });
      } else {
        setNotice({ ok: false, text: problemText(problemOf(result), "Доступ не змінено.") });
      }
    } catch {
      setNotice({ ok: false, text: "Немає зв'язку з сервером." });
    }
    setBusy(null);
  }

  const selected = dialog && "user" in dialog ? dialog.user : null;
  const titles: Record<Dialog["kind"], string> = {
    create: "Новий працівник",
    own: "Змінити мій пароль",
    edit: `Дані працівника${selected ? `: ${selected.displayName}` : ""}`,
    password: `Новий пароль${selected ? `: ${selected.displayName}` : ""}`,
  };

  return (
    <>
      <PageHead title="Працівники" sub="Доступ до адмінки: ролі, паролі, блокування. Пароль новому працівнику передайте особисто.">
        <button type="button" className="btn btn--quiet" onClick={() => open({ kind: "own" })}>
          Змінити мій пароль
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: "create" })}>
          <PlusIcon />
          Додати працівника
        </button>
      </PageHead>

      {notice && (
        <p className={notice.ok ? "notice notice--ok admin-notice" : "notice notice--error admin-notice"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}

      <StateBox state={users}>
        {users.data && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Працівник</th>
                  <th scope="col">Роль</th>
                  <th scope="col">Доступ</th>
                  <th scope="col" className="col-actions">
                    <span className="visually-hidden">Дії</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => {
                  const self = u.email.toLowerCase() === me.email.toLowerCase();
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="cell-strong">
                          {u.displayName}
                          {self && <span className="muted"> (ви)</span>}
                        </span>
                        <span className="cell-sub">{u.email}</span>
                      </td>
                      <td>
                        <span className={roleOf(u) === "Admin" ? "chip chip--dark" : "chip chip--grey"}>{roleLabel[roleOf(u)]}</span>
                      </td>
                      <td>{u.lockedOut ? <span className="chip chip--pink">Заблоковано</span> : <span className="chip chip--green">Активний</span>}</td>
                      <td className="col-actions">
                        <div className="admin-actions admin-actions--row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <button type="button" className="btn btn--small btn--quiet" onClick={() => open({ kind: "edit", user: u })}>
                            Змінити
                          </button>
                          <button type="button" className="btn btn--small btn--quiet" onClick={() => open({ kind: "password", user: u })}>
                            Новий пароль
                          </button>
                          <button
                            type="button"
                            className={u.lockedOut ? "btn btn--small btn--quiet" : "btn btn--small btn--danger"}
                            disabled={busy !== null}
                            aria-busy={busy === u.id}
                            onClick={() => lock(u)}
                          >
                            {u.lockedOut ? "Розблокувати" : "Заблокувати"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </StateBox>

      <Modal open={dialog !== null} title={dialog ? titles[dialog.kind] : ""} onClose={() => setDialog(null)}>
        {dialog?.kind === "create" && (
          <CreateUserForm
            onCreated={(user) => {
              if (users.data) users.setData([...users.data, user].sort((a, b) => a.email.localeCompare(b.email)));
              done(`Працівника ${user.displayName} додано. Передайте йому пароль особисто.`);
            }}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog?.kind === "own" && <OwnPasswordForm onDone={() => done("Ваш пароль змінено.")} onCancel={() => setDialog(null)} />}
        {dialog?.kind === "edit" && (
          <EditUserForm
            user={dialog.user}
            onSaved={(saved) => {
              replace(saved);
              done(`Дані працівника ${saved.displayName} збережено.`);
            }}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog?.kind === "password" && (
          <ResetPasswordForm
            user={dialog.user}
            onDone={() => done(`Пароль для ${dialog.user.displayName} змінено, активні сесії завершено.`)}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>
    </>
  );
}
