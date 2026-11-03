import type { components } from "@/shared/api/schema";

export type StaffUser = components["schemas"]["StaffUserDto"];
export type Role = "Admin" | "Manager";

export const roleLabel: Record<Role, string> = { Admin: "Адміністратор", Manager: "Менеджер" };
export const roleOf = (user: StaffUser): Role => (user.roles.includes("Admin") ? "Admin" : "Manager");

export const passwordHelp = "Щонайменше 10 символів.";
