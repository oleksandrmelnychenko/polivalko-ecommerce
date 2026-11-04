import { ContentSectionLayout } from "@/features/content";

export default function ContentLayout({ children }: LayoutProps<"/content">) {
  return <ContentSectionLayout>{children}</ContentSectionLayout>;
}
