"use client";

import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { getContacts } from "../api/client";
import { ContactsForm } from "./contacts-form";

export function ContactsEditorScreen() {
  const contacts = useAdminData("contacts", () => getContacts());
  return (
    <>
      <h1 className="admin-title">Контакти</h1>
      <p className="muted admin-lead">Видно на сторінці контактів, на головній і у футері сайту. Порожнє поле вітрина не показує.</p>
      <StateBox state={contacts}>{contacts.data && <ContactsForm initial={contacts.data} />}</StateBox>
    </>
  );
}
