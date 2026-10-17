import type { Metadata } from "next";
import Page, { Cards } from "@/components/Page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "About | TuneO" };

export default function AboutPage() {
  return (
    <Page
      eyebrow="About"
      title="A music studio you can own."
      intro="TuneO is an open-source, self-hosted studio for making songs with AI. It runs on your own machine, with your library, your files and your artist name kept on storage you control."
    >
      <h2>Why it exists</h2>
      <p>
        Hosted music tools are wonderful until a link expires, a plan changes or a song you loved disappears from a
        feed. TuneO keeps the creative loop fast while making ownership the default: every finished track, cover, stem
        and video is copied into your own object storage the moment it is ready.
      </p>
      <p>
        Generation runs through music models served by KIE. You bring an API key, pay only for what you make, and the
        app shows your balance in the sidebar so there are no surprises.
      </p>

      <h2>What you can do</h2>
      <Cards
        items={[
          {
            title: "Create",
            body: "Describe a song in Simple mode, or write lyrics and styles in Advanced with fine controls for weirdness, style influence, variety and length.",
          },
          {
            title: "Remix",
            body: "Cover a song in a new style, extend it from any point, or rewrite a single section without touching the rest.",
          },
          {
            title: "Take it apart",
            body: "Split vocals and instrumentals, export WAV, render a music video, or generate fresh cover art.",
          },
          {
            title: "Sing along",
            body: "Sync lyrics to the audio and follow every word as the song plays.",
          },
        ]}
      />

      <h2>How it is built</h2>
      <ul>
        <li>Next.js app for the studio interface and API.</li>
        <li>A background worker that follows every generation to the end, so closing the tab never loses a song.</li>
        <li>SQLite for your library and settings.</li>
        <li>OpenAI (optional) for drafting and rewriting lyrics in Advanced mode.</li>
        <li>RustFS, an S3 compatible store, for audio, artwork, stems and video.</li>
        <li>Docker Compose to run the whole thing with one command.</li>
      </ul>

      <h2>Open source</h2>
      <p>
        TuneO is free and open source under the GNU AGPL-3.0: use it, change it and share it, and if you share or host a
        modified version, share its source too.{" "}
        {SITE.githubUrl ? (
          <>
            The code lives on <a href={SITE.githubUrl}>GitHub</a>. If it is useful to you, a star helps others find it.
          </>
        ) : (
          <>The public repository is coming soon.</>
        )}
      </p>
      <p className="text-sm text-dim">TuneO is an independent open-source project. Version {SITE.version}.</p>
    </Page>
  );
}
