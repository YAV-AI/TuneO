import { uploadFile } from "@/lib/kie";

const LIMITS: Record<string, number> = { audio: 100 * 1024 * 1024, image: 10 * 1024 * 1024 };

// Uploads a user file to KIE's temp storage (24h) and returns a URL usable as a generation input.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  const kind = file.type.split("/")[0];
  if (!(kind in LIMITS)) return Response.json({ error: "Upload an audio or image file" }, { status: 400 });
  if (file.size > LIMITS[kind]) return Response.json({ error: "File is too large" }, { status: 413 });

  try {
    const url = await uploadFile(new Uint8Array(await file.arrayBuffer()), file.name, file.type);
    return Response.json({ url, kind, name: file.name });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
