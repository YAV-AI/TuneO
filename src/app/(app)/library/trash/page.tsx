import type { Metadata } from "next";
import { TrashTab } from "@/components/library/OtherTabs";

export const metadata: Metadata = { title: "Trash | TuneO" };

export default function LibraryTrashPage() {
  return <TrashTab />;
}
