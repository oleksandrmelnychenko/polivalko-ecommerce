import { ShopShell } from "@/features/shop/layout/server";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return <ShopShell>{children}</ShopShell>;
}
