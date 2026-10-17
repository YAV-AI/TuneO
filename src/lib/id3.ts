// Minimal ID3v2.3 writer for downloads: title, artist, album, year, genre, lyrics and cover art.
// v2.3 (not 2.4) because it is what Apple Music, Windows and most players read reliably.

export type Tags = {
  title: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  genre?: string;
  lyrics?: string;
  comment?: string;
  cover?: { data: Uint8Array; mime: string };
};

const enc = new TextEncoder();

// UTF-16 with BOM (encoding byte 0x01) so any language survives.
function utf16(text: string, terminate = false) {
  const s = terminate ? `${text}\0` : text;
  const out = new Uint8Array(2 + s.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[2 + i * 2] = c & 0xff;
    out[3 + i * 2] = c >> 8;
  }
  return out;
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function frame(id: string, body: Uint8Array) {
  const head = new Uint8Array(10);
  head.set(enc.encode(id), 0);
  new DataView(head.buffer).setUint32(4, body.length); // v2.3 frame sizes are plain 32-bit
  return concat([head, body]);
}

const text = (id: string, value?: string) => (value ? frame(id, concat([new Uint8Array([1]), utf16(value)])) : null);

function lyricsFrame(lyrics: string) {
  // USLT: encoding, language, empty descriptor, text
  return frame("USLT", concat([new Uint8Array([1]), enc.encode("eng"), utf16("", true), utf16(lyrics)]));
}

function commentFrame(comment: string) {
  return frame("COMM", concat([new Uint8Array([1]), enc.encode("eng"), utf16("", true), utf16(comment)]));
}

function pictureFrame(data: Uint8Array, mime: string) {
  // APIC: encoding 0 (latin1), mime, picture type 3 (front cover), empty description
  return frame("APIC", concat([new Uint8Array([0]), enc.encode(`${mime}\0`), new Uint8Array([3, 0]), data]));
}

function syncsafe(n: number) {
  return new Uint8Array([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);
}

// Size of an existing ID3v2 tag at the start of the file (0 if none).
function existingTagLength(mp3: Uint8Array) {
  if (mp3.length < 10 || mp3[0] !== 0x49 || mp3[1] !== 0x44 || mp3[2] !== 0x33) return 0;
  const size = (mp3[6] << 21) | (mp3[7] << 14) | (mp3[8] << 7) | mp3[9];
  const footer = mp3[5] & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

// Returns a new MP3 with any old ID3v2 tag replaced by ours.
export function tagMp3(mp3: Uint8Array, tags: Tags) {
  const frames = [
    text("TIT2", tags.title),
    text("TPE1", tags.artist),
    text("TPE2", tags.albumArtist),
    text("TALB", tags.album),
    text("TYER", tags.year),
    text("TCON", tags.genre),
    tags.lyrics ? lyricsFrame(tags.lyrics) : null,
    tags.comment ? commentFrame(tags.comment) : null,
    tags.cover ? pictureFrame(tags.cover.data, tags.cover.mime) : null,
  ].filter((f) => f !== null) as Uint8Array[];

  const body = concat(frames);
  const header = concat([enc.encode("ID3"), new Uint8Array([3, 0, 0]), syncsafe(body.length)]);
  return concat([header, body, mp3.subarray(existingTagLength(mp3))]);
}
