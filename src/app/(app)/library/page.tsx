import type { Metadata } from "next";
import SongsTab from "@/components/library/SongsTab";

export const metadata: Metadata = { title: "Library | TuneO" };

export default function LibrarySongsPage() {
  return <SongsTab />;
}
