import type { Metadata } from "next";
import { ArtTab } from "@/components/library/OtherTabs";

export const metadata: Metadata = { title: "Cover Art | TuneO" };

export default function LibraryArtPage() {
  return <ArtTab />;
}
