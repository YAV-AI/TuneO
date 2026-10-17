import type { Metadata } from "next";
import Page from "@/components/Page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Help | TuneO" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is the difference between Simple and Advanced?",
    a: (
      <>
        Simple takes a short description and writes the lyrics for you. Advanced gives you full control: your own
        lyrics, styles, a title, and More Options for vocal gender, duration, weirdness, style influence and variety.
      </>
    ),
  },
  {
    q: "Which model should I pick?",
    a: (
      <>
        <strong>v6</strong> has the most natural vocals and detail. <strong>v6-mini</strong> is faster and great for
        sketching ideas. <strong>v6-wild</strong> takes bigger creative risks.
      </>
    ),
  },
  {
    q: "Which API keys do I need?",
    a: (
      <ul>
        <li>
          <code>KIE_API_KEY</code> (required): every song, cover, extension, stem, video and style boost runs through
          KIE.
        </li>
        <li>
          <code>OPENAI_KEY</code> (optional): powers the Write button in Advanced mode, which drafts or rewrites lyrics
          from your title, style and existing draft. Set <code>OPENAI_MODEL</code> to choose the model (default{" "}
          <code>gpt-5.5</code>). Without this key everything else still works; you just write lyrics yourself or let
          Simple mode write them.
        </li>
      </ul>
    ),
  },
  {
    q: "Why do I get two songs each time?",
    a: <>Every generation returns two takes of the same idea. Keep the one you like, or both.</>,
  },
  {
    q: "Can I close the tab while a song is generating?",
    a: (
      <>
        Yes. A background worker follows each job to the end and saves the result, so your songs will be waiting when
        you come back.
      </>
    ),
  },
  {
    q: "How long are my songs kept?",
    a: (
      <>
        Forever, on your own storage. KIE deletes its copies after 14 days, so TuneO archives every finished file to
        RustFS automatically.
      </>
    ),
  },
  {
    q: "What do the actions in the song menu cost?",
    a: (
      <ul>
        <li>Create, Cover, Extend: 12 credits</li>
        <li>Replace Section: 5 credits</li>
        <li>Stems: 10 credits</li>
        <li>Music video: 2 credits</li>
        <li>WAV and synced lyrics: under 1 credit</li>
        <li>Cover art: free</li>
      </ul>
    ),
  },
  {
    q: "How do I set my artist name?",
    a: (
      <>
        Click the avatar in the sidebar. Your name appears in the player and song details, and signs any music video you
        render.
      </>
    ),
  },
  {
    q: "Something failed. What now?",
    a: (
      <>
        Failed songs are marked in the library with the reason from KIE. The most common causes are an empty credit
        balance and prompts that name a real artist. Check the worker logs with <code>docker compose logs worker</code>.
      </>
    ),
  },
];

const SHORTCUTS = [
  ["Space", "Play or pause"],
  ["Esc", "Close a menu or dialog"],
];

export default function HelpPage() {
  return (
    <Page
      eyebrow="Help"
      title="Make your first song in a minute."
      intro="Everything you need to know about creating, remixing and keeping your music in TuneO."
    >
      <h2>Getting started</h2>
      <ol className="mt-3 flex flex-col gap-3">
        {[
          "Add KIE_API_KEY to .env for music generation, and OPENAI_KEY if you want AI lyric writing. Then run docker compose up -d.",
          "Describe a song in Simple mode, or switch to Advanced to write lyrics and styles.",
          "Press Create. Two versions appear in your library and start playing as soon as they stream.",
          "Open the menu on any song to cover, extend, split stems or download it.",
        ].map((step, i) => (
          <li key={step} className="flex gap-4 rounded-2xl bg-surface p-4 text-[15px] text-soft">
            <span className="font-mono text-sm text-dim">{String(i + 1).padStart(2, "0")}</span>
            {step}
          </li>
        ))}
      </ol>

      <h2>Questions</h2>
      <div className="mt-3 flex flex-col divide-y divide-line border-y border-line">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
              {q}
              <span className="text-dim transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-3 text-[15px] leading-relaxed text-soft">{a}</div>
          </details>
        ))}
      </div>

      <h2>Keyboard</h2>
      <div className="mt-3 flex flex-col gap-2">
        {SHORTCUTS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm">
            <span className="text-soft">{label}</span>
            <kbd className="rounded-md border border-line bg-bar px-2 py-0.5 font-mono text-xs">{key}</kbd>
          </div>
        ))}
      </div>

      <h2>Still stuck?</h2>
      <p>
        {SITE.githubUrl ? (
          <>
            Open an issue on <a href={`${SITE.githubUrl}/issues`}>GitHub</a> with what you tried and what happened.
          </>
        ) : (
          <>Issue tracking opens with the public GitHub repository, coming soon.</>
        )}
      </p>
    </Page>
  );
}
