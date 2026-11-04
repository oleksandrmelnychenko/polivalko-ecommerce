"use client";

import { useCustomer } from "@/features/customer";
import { CabinetHead } from "./cabinet-head";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export function ProfileScreen() {
  const { me } = useCustomer();
  if (!me) return null;
  return (
    <section aria-labelledby="cabinet-title">
      <CabinetHead title="Профіль" />
      <div className="profile-grid">
        <ProfileForm me={me} />
        <PasswordForm email={me.email} />
      </div>
    </section>
  );
}
