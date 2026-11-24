"use client";

import { useRef, useState } from "react";
import { useCustomer } from "@/features/customer";
import { ChevronDownIcon, ShieldIcon, UserIcon } from "@polivalko/shared/ui/icons";
import { CabinetHead } from "./cabinet-head";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export function ProfileScreen() {
  const { me } = useCustomer();
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  if (!me) return null;
  return (
    <section aria-labelledby="cabinet-title">
      <CabinetHead title="Профіль" />
      <div className="profile-grid">
        <section className="profile-contact" aria-labelledby="profile-title">
          <h3 id="profile-title"><UserIcon />Контактні дані</h3>
          {editing ? (
            <ProfileForm me={me} onClose={() => {
              setEditing(false);
              requestAnimationFrame(() => editButton.current?.focus());
            }} />
          ) : (
            <>
              <dl className="profile-facts">
                <div><dt>Ім’я та прізвище</dt><dd>{me.name}</dd></div>
                <div><dt>Телефон</dt><dd>{me.phone || "Не вказано"}</dd></div>
              </dl>
              <button ref={editButton} type="button" className="btn btn--quiet btn--small" onClick={() => setEditing(true)}>Редагувати контакти</button>
            </>
          )}
        </section>
        <section className="profile-access" aria-labelledby="access-title">
          <h3 id="access-title"><ShieldIcon />Вхід до кабінету</h3>
          <dl className="profile-email">
            <dt>Електронна пошта для входу</dt>
            <dd>{me.email}</dd>
          </dl>
          <span className={me.emailConfirmed ? "status-chip status-chip--ok" : "status-chip"}>
            {me.emailConfirmed ? "Пошту підтверджено" : "Очікує підтвердження"}
          </span>
          <details className="profile-password">
            <summary>Змінити пароль<ChevronDownIcon /></summary>
            <PasswordForm owner={me.id} email={me.email} />
          </details>
        </section>
      </div>
    </section>
  );
}
