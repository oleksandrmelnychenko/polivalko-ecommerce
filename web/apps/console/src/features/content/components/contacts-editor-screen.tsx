"use client";

import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { getContacts } from "../api/client";
import { ContactsForm } from "./contacts-form";

export function ContactsEditorScreen() {
  const contacts = useConsoleData("contacts", () => getContacts());
  return (
    <>
      <h1 className="console-title">Контакти</h1>
      <p className="muted console-lead">Видно на сторінці контактів, на головній і у футері сайту. Порожнє поле вітрина не показує.</p>
      <StateBox state={contacts}>{contacts.data && <ContactsForm initial={contacts.data} />}</StateBox>
    </>
  );
}
