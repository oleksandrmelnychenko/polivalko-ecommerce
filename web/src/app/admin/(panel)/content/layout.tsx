import { ContentSectionLayout } from "@/features/admin/content";

export default function ContentLayout({ children }: LayoutProps<"/admin/content">) {
  return <ContentSectionLayout>{children}</ContentSectionLayout>;
}
