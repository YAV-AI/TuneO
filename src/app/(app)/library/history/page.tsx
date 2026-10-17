import type { Metadata } from "next";
import { HistoryTab } from "@/components/library/OtherTabs";

export const metadata: Metadata = { title: "History | TuneO" };

export default function LibraryHistoryPage() {
  return <HistoryTab />;
}
