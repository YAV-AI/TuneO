import LibraryShell from "@/components/library/LibraryShell";

export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return <LibraryShell>{children}</LibraryShell>;
}
