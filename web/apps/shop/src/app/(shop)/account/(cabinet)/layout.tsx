import { AccountShell } from "@/features/account";
import { customerMailDelivers } from "@/features/content/server";

export default function CabinetLayout({ children }: LayoutProps<"/account">) {
  return <AccountShell mailDelivers={customerMailDelivers}>{children}</AccountShell>;
}
