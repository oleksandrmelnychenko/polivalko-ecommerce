import type { Metadata } from "next";

// Адмінка за входом рендериться на клієнті з даними працівника, тож миттєву навігацію
// з публічних сторінок не перевіряємо (переходи всередині адмінки перевіряються й далі).
export const instant = false;

// Адмінка закрита від індексації (розділ 10 ТЗ); вхід, ролі й CSRF перевіряє ASP.NET Core.
export const metadata: Metadata = {
  title: { default: "Адмінка", template: "%s | Адмінка Poli Valko" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="admin">{children}</div>;
}
