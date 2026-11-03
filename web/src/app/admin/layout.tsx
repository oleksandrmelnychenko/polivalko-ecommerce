import type { Metadata } from "next";

export const instant = false;

export const metadata: Metadata = {
  title: { default: "Адмінка", template: "%s | Адмінка Poli Valko" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="admin">{children}</div>;
}
