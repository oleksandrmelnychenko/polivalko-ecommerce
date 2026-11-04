import { AccountShell } from "@/features/account";

export default function CabinetLayout({ children }: LayoutProps<"/account">) {
  return <AccountShell>{children}</AccountShell>;
}
