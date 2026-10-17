import { getObject } from "./storage";

// Streams an object from storage with Range support (seeking) and an optional download name.
export async function streamObject(req: Request, key: string, downloadName: string) {
  const range = req.headers.get("range") ?? undefined;
  try {
    const obj = await getObject(key, range);
    const headers = new Headers({
      "Content-Type": obj.ContentType ?? "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000, immutable",
    });
    if (obj.ContentLength != null) headers.set("Content-Length", String(obj.ContentLength));
    if (obj.ContentRange) headers.set("Content-Range", obj.ContentRange);
    if (new URL(req.url).searchParams.has("download")) {
      // A download's name and tags follow the song's current title, so never cache it.
      headers.set("Cache-Control", "no-store");
      const ext = key.split(".").pop();
      const name = downloadName.replace(/[^\w\- ]+/g, "").trim() || "download";
      headers.set("Content-Disposition", `attachment; filename="${name}.${ext}"`);
    }
    return new Response(obj.Body!.transformToWebStream(), { status: obj.ContentRange ? 206 : 200, headers });
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 416) return new Response("Range not satisfiable", { status: 416 });
    console.error("[media]", key, err);
    return new Response("Storage unavailable", { status: 502 });
  }
}
