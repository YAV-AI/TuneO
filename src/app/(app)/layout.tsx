import AppShell from "@/components/AppShell";

// Sidebar and player persist across pages so playback never stops on navigation.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
