"use client";

import { useState } from "react";
import { useStaff } from "@/features/auth";
import { withCsrf } from "@/shared/csrf";
import { useConsoleData } from "@/shared/use-console-data";
import { Modal } from "@/shared/ui/modal";
import { PageHead } from "@/shared/ui/page-head";
import { StateBox } from "@/shared/ui/state-box";
import { problemOf, problemText } from "@polivalko/shared/api/problem";
import { PlusIcon } from "@polivalko/shared/ui/icons";
import { getUsers, lockUser } from "../api/client";
import type { StaffUser } from "../lib/roles";
import { StaffCreateForm } from "./staff-create-form";
import { StaffEditForm } from "./staff-edit-form";
import { StaffOwnPasswordForm } from "./staff-own-password-form";
import { StaffResetPasswordForm } from "./staff-reset-password-form";
import { StaffTable } from "./staff-table";

type Dialog = { kind: "create" } | { kind: "own" } | { kind: "edit" | "password"; user: StaffUser };

export function StaffScreen() {
  const { isAdmin } = useStaff();
  if (!isAdmin)
    return (
      <>
        <h1 className="console-title">Мій пароль</h1>
        <div className="console-panel console-narrow">
          <StaffOwnPasswordForm />
        </div>
      </>
    );
  return <Staff />;
}

function Staff() {
  const { me } = useStaff();
  const users = useConsoleData("users", () => getUsers());
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
      const result = await withCsrf((headers) => lockUser(headers, user.id, { locked }));
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
      <PageHead title="Працівники" sub="Доступ до консолі: ролі, паролі, блокування. Пароль новому працівнику передайте особисто.">
        <button type="button" className="btn btn--quiet" onClick={() => open({ kind: "own" })}>
          Змінити мій пароль
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: "create" })}>
          <PlusIcon />
          Додати працівника
        </button>
      </PageHead>

      {notice && (
        <p className={notice.ok ? "notice notice--ok console-notice" : "notice notice--error console-notice"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}

      <StateBox state={users}>
        {users.data && (
          <StaffTable
            users={users.data}
            email={me.email}
            busy={busy}
            onEdit={(user) => open({ kind: "edit", user })}
            onPassword={(user) => open({ kind: "password", user })}
            onLock={lock}
          />
        )}
      </StateBox>

      <Modal open={dialog !== null} title={dialog ? titles[dialog.kind] : ""} onClose={() => setDialog(null)}>
        {dialog?.kind === "create" && (
          <StaffCreateForm
            onCreated={(user) => {
              if (users.data) users.setData([...users.data, user].sort((a, b) => a.email.localeCompare(b.email)));
              done(`Працівника ${user.displayName} додано. Передайте йому пароль особисто.`);
            }}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog?.kind === "own" && <StaffOwnPasswordForm onDone={() => done("Ваш пароль змінено.")} onCancel={() => setDialog(null)} />}
        {dialog?.kind === "edit" && (
          <StaffEditForm
            user={dialog.user}
            onSaved={(saved) => {
              replace(saved);
              done(`Дані працівника ${saved.displayName} збережено.`);
            }}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog?.kind === "password" && (
          <StaffResetPasswordForm
            user={dialog.user}
            onDone={() => done(`Пароль для ${dialog.user.displayName} змінено, активні сесії завершено.`)}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>
    </>
  );
}
