// Thin client for the KIE task API. See docs/MUSIC_API.md.
const BASE = "https://api.kie.ai";

type Envelope<T> = { code: number; msg: string; data: T };

export class KieError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(pathname: string, init?: RequestInit): Promise<T> {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new KieError(500, "KIE_API_KEY is not set");
  const res = await fetch(BASE + pathname, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = (await res.json()) as Envelope<T>;
  // KIE reports errors in the body code, HTTP status may still be 200.
  if (body.code !== 200) throw new KieError(body.code, body.msg);
  return body.data;
}

export function createTask(model: string, input: Record<string, unknown>) {
  return call<{ taskId: string }>("/api/v1/jobs/createTask", {
    method: "POST",
    body: JSON.stringify({ model, input }),
  });
}

export type MusicTrack = {
  id: string;
  audio_url?: string;
  stream_audio_url?: string;
  image_url?: string;
  prompt?: string;
  title?: string;
  tags?: string;
  duration?: number;
  model_name?: string;
};

export type RecordInfo = {
  taskId: string;
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  failMsg: string | null;
  creditsConsumed?: number | null;
  response: { data?: MusicTrack[]; [key: string]: unknown } | null;
};

export function recordInfo(taskId: string) {
  return call<RecordInfo>(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
}

const UPLOAD_BASE = "https://kieai.redpandaai.co";

// Temporary KIE-hosted file (deleted after 24h) for endpoints that need a public URL.
export async function uploadFile(bytes: Uint8Array, fileName: string, contentType: string) {
  const form = new FormData();
  form.set("file", new Blob([bytes as BlobPart], { type: contentType }), fileName);
  form.set("uploadPath", "tuneo");
  form.set("fileName", fileName);
  const res = await fetch(`${UPLOAD_BASE}/api/file-stream-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}` },
    body: form,
  });
  const body = (await res.json()) as Envelope<{ downloadUrl: string }>;
  if (body.code !== 200) throw new KieError(body.code, body.msg);
  return body.data.downloadUrl;
}
