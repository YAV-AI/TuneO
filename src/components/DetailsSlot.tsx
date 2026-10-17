"use client";

import DetailsPanel from "./DetailsPanel";
import { useStudio } from "./StudioContext";

// Right-hand song details drawer, rendered by pages that list songs.
export default function DetailsSlot() {
  const { detailsId, setDetailsId, current, playing, time, load } = useStudio();
  if (!detailsId) return null;
  return (
    <DetailsPanel
      songId={detailsId}
      playingId={playing ? (current?.id ?? null) : null}
      currentTime={time}
      onClose={() => setDetailsId(null)}
      onChanged={load}
      onOpenSong={setDetailsId}
    />
  );
}
