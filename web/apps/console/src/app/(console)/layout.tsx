export const instant = false;

export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return <div className="console">{children}</div>;
}
