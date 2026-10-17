"use client";

import { useCallback, useEffect, useState } from "react";
import type { SongDetail } from "./types";

// Loads a song's detail (assets, running jobs) and keeps polling while a job runs.
export function useSongDetail(id: string | null) {
  const [detail, setDetail] = useState<SongDetail | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/songs/${id}`, { cache: "no-store" });
    if (res.ok) setDetail(await res.json());
  }, [id]);

  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);

  const running = (detail?.running.length ?? 0) > 0;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [running, reload]);

  return { detail: detail?.song.id === id ? detail : null, reload };
}
