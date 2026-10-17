import type { Metadata } from "next";
import CreditsView from "@/components/CreditsView";

export const metadata: Metadata = { title: "Credits | TuneO" };

export default function CreditsPage() {
  return <CreditsView />;
}
